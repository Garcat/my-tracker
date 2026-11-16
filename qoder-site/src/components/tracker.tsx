'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ResultList from '@/app/track/resultList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

import { loadSharedTrackingState, saveParcels, saveSharedState, saveTrackingSnapshot } from '@/lib/storage-api';
import { authHeaders } from '@/lib/auth-api';
import { ParcelInfo, ParcelMap, TrackingResult } from '@/types/tracking';

// 编辑后延迟落库的防抖时间：避免每敲一个键就写一次共享数据
const SAVE_DEBOUNCE_MS = 800;
// 批量查询的并发上限：提速的同时避免触发上游限流
const FETCH_CONCURRENCY = 3;

function formatLastQueryTime(timestamp: number): string {
	return new Date(timestamp).toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});
}

// 运单号 = 输入行首个空格/Tab 前的部分，与后端关联包裹信息的键保持一致
function wayBillCodeOf(line: string): string {
	return line.trim().split(/\s+/)[0] ?? '';
}

// 只保留当前输入中仍存在的运单的包裹信息（与后端的级联删除一致）
function pruneParcels(parcels: ParcelMap, lines: string[]): ParcelMap {
	const allowed = new Set(lines.map(wayBillCodeOf).filter(Boolean));
	const next: ParcelMap = {};
	for (const [code, parcel] of Object.entries(parcels)) {
		if (allowed.has(code)) next[code] = parcel;
	}
	return next;
}

// 已签收：后续刷新时沿用旧结果，不再请求上游
function isDeliveredResult(result: TrackingResult | null): boolean {
	if (!result || !result.data || !result.data.hisList || result.data.hisList.length === 0) {
		return false;
	}
	return JSON.stringify(result.data.hisList[0].toStatus).includes('感谢使用');
}

const App: React.FC = () => {
	const [texts, setTexts] = useState<string[]>([]);
	const [responses, setResponses] = useState<(TrackingResult | null)[]>([]);
	const [parcels, setParcels] = useState<ParcelMap>({});
	const [errors, setErrors] = useState<(string | null)[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [hasFirstData, setHasFirstData] = useState(false);
	const [count, setCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
	const [refreshingIndex, setRefreshingIndex] = useState<number | null>(null);

	// 始终持有最新的 texts/responses/errors，供单条刷新回调读取，避免闭包过期
	const textsRef = useRef(texts);
	const responsesRef = useRef(responses);
	const errorsRef = useRef(errors);
	useEffect(() => {
		textsRef.current = texts;
		responsesRef.current = responses;
		errorsRef.current = errors;
	}, [texts, responses, errors]);

	const endpoint = '/functions/v1/app/track';

	// 待落库的最新快照（inputs 与 results 一起写入）
	const pendingSaveRef = useRef<{ inputs: string[]; results: (TrackingResult | null)[] } | null>(null);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const cancelPendingSave = useCallback(() => {
		if (saveTimerRef.current !== null) {
			clearTimeout(saveTimerRef.current);
			saveTimerRef.current = null;
		}
		pendingSaveRef.current = null;
	}, []);

	// 立即把待写入的快照合并成一次 PUT
	const flushPendingSave = useCallback(() => {
		if (saveTimerRef.current !== null) {
			clearTimeout(saveTimerRef.current);
			saveTimerRef.current = null;
		}
		const pending = pendingSaveRef.current;
		pendingSaveRef.current = null;
		if (pending) {
			void saveSharedState(pending.inputs, pending.results);
		}
	}, []);

	// 编辑时只更新本地状态，800ms 内无新输入才落库
	const scheduleSave = useCallback((inputs: string[], results: (TrackingResult | null)[]) => {
		pendingSaveRef.current = { inputs, results };
		if (saveTimerRef.current !== null) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(() => {
			saveTimerRef.current = null;
			const pending = pendingSaveRef.current;
			pendingSaveRef.current = null;
			if (pending) {
				void saveSharedState(pending.inputs, pending.results);
			}
		}, SAVE_DEBOUNCE_MS);
	}, []);

	// 从输入行中提取运单号：忽略号码后面以空格/Tab 分隔的地点等附加信息（如 "B0002807688	招商" -> "B0002807688"）
	const extractWayBillCode = (text: string): string => {
		return text.trim().split(/\s+/)[0] ?? '';
	};

	useEffect(() => {
		// Load shared data from the site Function
		const loadData = async () => {
			try {
				const { inputs, results, parcels: loadedParcels, lastTrackingFetchAt } = await loadSharedTrackingState();
				setTexts(inputs);
				// Restore the last query results so they show on open（按 inputs 长度补齐，避免历史数据长度不一致）
				const alignedResults = inputs.map((_, index) => results[index] ?? null);
				setResponses(alignedResults);
				setParcels(loadedParcels ?? {});
				setErrors(new Array(inputs.length).fill(null));
				if (alignedResults.some(r => r !== null)) {
					setHasFirstData(true);
				}
				if (lastTrackingFetchAt !== null) {
					setLastUpdatedAt(lastTrackingFetchAt);
				}
			} catch (error) {
				console.error('Failed to load shared data:', error);
				// Fallback to localStorage if the Function is unavailable
				const storedPreviousInputs = localStorage.getItem('previousInputs');
				if (storedPreviousInputs) {
					setTexts(JSON.parse(storedPreviousInputs));
				}
			} finally {
				setIsLoading(false);
			}
		};

		loadData();
	}, []);

	// 离开页面时把尚未落库的编辑补写一次
	useEffect(() => {
		return () => {
			flushPendingSave();
		};
	}, [flushPendingSave]);

	// 行内编辑包裹内容：一次 PUT 只提交该运单，成功后同步本地状态
	const handleSaveParcel = useCallback(async (code: string, parcel: ParcelInfo): Promise<boolean> => {
		const ok = await saveParcels({ [code]: parcel });
		if (ok) {
			setParcels((current) => ({ ...current, [code]: parcel }));
		}
		return ok;
	}, []);

	const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		const text = event.target.value;
		const lines = text.split('\n');
		const previousLines = texts;

		setTexts(lines);

		// 按下标逐行映射，找不到旧行时保留 null 占位，保证 results 长度始终等于 inputs
		const nextResponses = lines.map((currentLine) => {
			const previousIndex = previousLines.indexOf(currentLine);

			// If this line existed in the previous input and we have a result for it
			if (previousIndex !== -1 && previousIndex < responses.length) {
				return responses[previousIndex];
			}
			return null;
		});

		const nextErrors = lines.map((currentLine) => {
			const previousIndex = previousLines.indexOf(currentLine);

			if (previousIndex !== -1 && previousIndex < errors.length) {
				return errors[previousIndex];
			}
			return null;
		});

		setResponses(nextResponses);
		setErrors(nextErrors);
		// 输入中删掉运单号时立即从界面移除其包裹信息；
		// 落库时后端会按最新 inputs 再级联清理一次。
		setParcels((current) => pruneParcels(current, lines));

		// 合并写入 inputs + results，且只在停止输入 800ms 后触发一次
		scheduleSave(lines, nextResponses);
	};

	const fetchData = async () => {
		const nextResults: (TrackingResult | null)[] = new Array(texts.length).fill(null);
		const nextErrors: (string | null)[] = new Array(texts.length).fill(null);
		const queue: number[] = [];

		// 先按行号占位：空行留 null，已签收沿用旧结果，其余进入查询队列
		for (let i = 0; i < texts.length; i++) {
			const wayBillCode = extractWayBillCode(texts[i]);
			if (!wayBillCode) {
				continue;
			}
			const existingResult = responses[i] ?? null;
			if (isDeliveredResult(existingResult)) {
				nextResults[i] = existingResult;
				continue;
			}
			// 查询前保留旧结果：即使本次失败也不会丢掉上次的状态
			nextResults[i] = existingResult;
			queue.push(i);
		}

		let pendingCount = queue.length;
		let succeeded = 0;
		setCount(pendingCount);
		setResponses([...nextResults]);
		setErrors([...nextErrors]);

		const runOne = async (index: number) => {
			const wayBillCode = extractWayBillCode(texts[index]);
			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...authHeaders() },
					body: JSON.stringify({ wayBillCode }),
				});
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}
				const data = (await response.json()) as TrackingResult;
				nextResults[index] = data;
				nextErrors[index] = null;
				succeeded += 1;
				setHasFirstData(true);
			} catch (err: unknown) {
				// 单条失败不影响其余行：记录错误并保留该行的旧结果
				nextErrors[index] = err instanceof Error ? err.message : '查询失败';
			} finally {
				pendingCount -= 1;
				setCount(pendingCount);
				setResponses([...nextResults]);
				setErrors([...nextErrors]);
			}
		};

		try {
			// 小并发池：同时最多 FETCH_CONCURRENCY 条在途
			let cursor = 0;
			const workerCount = Math.min(FETCH_CONCURRENCY, queue.length);
			const workers = Array.from({ length: workerCount }, async () => {
				while (cursor < queue.length) {
					const index = queue[cursor];
					cursor += 1;
					await runOne(index);
				}
			});
			await Promise.all(workers);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Unknown errors');
		} finally {
			const failed = nextErrors.filter((item) => item !== null).length;
			setError(
				failed > 0
					? `${failed} 条查询失败，已在对应行标出，可再次点击 Submit 重试`
					: null,
			);

			// 整批结束后一次性保存完整快照（inputs + results 按下标对齐）
			if (texts.some((line) => line.trim())) {
				if (succeeded > 0 || queue.length === 0) {
					const now = Date.now();
					setLastUpdatedAt(now);
					await saveTrackingSnapshot(texts, nextResults, now);
				} else {
					// 全部失败：不刷新“最后查询时间”，只保存对齐后的数据
					await saveSharedState(texts, nextResults);
				}
			}

			setLoading(false);
		}
	};

	const handleSubmit = () => {
		// 提交后会用整批快照写入，先取消待执行的防抖写，避免旧快照覆盖新结果
		cancelPendingSave();
		setLoading(true);
		setHasFirstData(false);
		void fetchData();
	};

	// 单条刷新：只重新查询指定下标对应的运单号并更新该条结果
	const handleRefreshOne = useCallback(async (index: number) => {
		if (refreshingIndex !== null) return;
		const wayBillCode = extractWayBillCode(textsRef.current[index] ?? '');
		if (!wayBillCode) return;
		// 与批量查询互斥，取消待执行的防抖写避免旧快照覆盖刷新结果
		cancelPendingSave();
		setRefreshingIndex(index);
		setError(null);
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...authHeaders() },
				body: JSON.stringify({ wayBillCode }),
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const data = (await response.json()) as TrackingResult;
			const nextResponses = [...responsesRef.current];
			const nextErrors = [...errorsRef.current];
			while (nextResponses.length <= index) {
				nextResponses.push(null);
				nextErrors.push(null);
			}
			nextResponses[index] = data;
			nextErrors[index] = null;
			setResponses(nextResponses);
			setErrors(nextErrors);
			setHasFirstData(true);
			const now = Date.now();
			setLastUpdatedAt(now);
			await saveTrackingSnapshot(textsRef.current, nextResponses, now);
		} catch (err: unknown) {
			// 失败时保留该行旧结果，错误写入对应行
			const nextErrors = [...errorsRef.current];
			while (nextErrors.length <= index) {
				nextErrors.push(null);
			}
			nextErrors[index] = err instanceof Error ? err.message : '查询失败';
			setErrors(nextErrors);
			setError(`${wayBillCode} 刷新失败，原状态保留`);
		} finally {
			setRefreshingIndex(null);
		}
	}, [refreshingIndex, cancelPendingSave]);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background site-shell">
				<div className="container mx-auto max-w-7xl">
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-8 w-8 animate-spin" />
						<span className="ml-2">Loading shared data...</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background site-shell">
			<div className="container mx-auto max-w-7xl">
				<div className="grid grid-cols-1 md:grid-cols-3 site-grid">
					<Card className="lg:col-span-1">
						<CardHeader>
							<CardTitle>Track Numbers</CardTitle>
							<CardDescription>Enter tracking numbers to check their status</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<textarea
								value={texts.join('\n')}
								onChange={handleTextChange}
								onBlur={flushPendingSave}
								rows={15}
								placeholder="Enter multiple lines of text..."
								className="w-full p-3 border border-input rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<Button
								onClick={handleSubmit}
								disabled={loading}
								className="w-full bg-[var(--site-accent)] hover:brightness-110 text-[var(--site-on-accent)]"
							>
								{loading ? (<span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...</span>) : 'Submit'}
							</Button>
							{lastUpdatedAt !== null && (
								<p className="text-center text-xs text-muted-foreground">
									最后更新：{formatLastQueryTime(lastUpdatedAt)}
								</p>
							)}
							{error && (
								<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
									<p className="text-destructive text-sm">{error}</p>
								</div>
							)}
							<p className="text-center text-sm text-muted-foreground">
								v26.11.16 • {texts.length} tracking numbers
							</p>
						</CardContent>
					</Card>

					<Card className="md:col-span-2">
						<CardHeader>
							<CardTitle>Tracking Results</CardTitle>
							<CardDescription>
								{loading ? (
									<span className="inline-flex items-center">
										<Loader2 className="mr-2 h-4 w-4 animate-spin" /> {count > 0 ? `${count} updates left` : 'Updating...'}
									</span>
								) : `${texts.length} records updated.`}
							</CardDescription>
							{lastUpdatedAt !== null && (
								<p className="text-xs text-muted-foreground mt-2">
									最后一次查询：{formatLastQueryTime(lastUpdatedAt)}
								</p>
							)}
						</CardHeader>
						<CardContent>
							{!hasFirstData && loading ? (
								<div className="flex items-center justify-center py-8">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
									<span className="ml-2">Loading...</span>
								</div>
							) : (
								<ResultList
									trackNo={texts}
									results={responses}
									errors={errors}
									parcels={parcels}
									onSaveParcel={handleSaveParcel}
									onRefresh={handleRefreshOne}
									refreshingIndexes={refreshingIndex !== null ? new Set([refreshingIndex]) : undefined}
									disabled={loading}
								/>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};

export default App;
