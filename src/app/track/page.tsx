'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ResultList from './resultList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
// 当前使用的存储方案：服务器端 API (Next.js API Routes + 文件系统)
// 这个方案提供真正的服务器端持久化，数据在重启/部署后依然保留

import { loadSharedTrackingState, saveSharedInputs, saveSharedResults, saveTrackingSnapshot } from '@/lib/storage-api';
import { TrackingResult } from '@/types/tracking';

const TRACK_ENDPOINT = '/api/track';
// 单条刷新的请求超时：上游卡住时主动中断，避免图标一直转且没有任何反馈
const REFRESH_TIMEOUT_MS = 20000;

// 从输入行中提取运单号：忽略号码后面以空格/Tab 分隔的地点等附加信息（如 "B0002807688	招商" -> "B0002807688"）
function extractWayBillCode(text: string): string {
	return text.trim().split(/\s+/)[0] ?? '';
}

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

const App: React.FC = () => {
	const [texts, setTexts] = useState<string[]>([]);
	const [responses, setResponses] = useState<(TrackingResult | null)[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [hasFirstData, setHasFirstData] = useState(false);
	const [count, setCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
	// 正在单条刷新的行（支持多行并发，卡住一行不再阻塞其他行）
	const [refreshingIndexes, setRefreshingIndexes] = useState<Set<number>>(() => new Set());
	// 与 responses 按下标对齐的单条刷新错误提示
	const [rowErrors, setRowErrors] = useState<(string | null)[]>([]);

	// 始终持有最新的 texts/responses，供单条刷新回调读取，避免闭包过期
	const textsRef = useRef(texts);
	const responsesRef = useRef(responses);
	// 在途刷行的镜像集合，用于去重判断而不依赖 state 闭包
	const refreshingRef = useRef<Set<number>>(new Set());
	useEffect(() => {
		textsRef.current = texts;
		responsesRef.current = responses;
	}, [texts, responses]);

	useEffect(() => {
		// Load shared data from server
		const loadData = async () => {
			try {
				const { inputs, results, lastTrackingFetchAt } = await loadSharedTrackingState();
				setTexts(inputs);
				// Restore the last query results so they show on open
				setResponses(results);
				if (results.some((r) => r !== null)) {
					setHasFirstData(true);
				}
				if (lastTrackingFetchAt !== null) {
					setLastUpdatedAt(lastTrackingFetchAt);
				}
			} catch (error) {
				console.error('Failed to load shared data:', error);
				// Fallback to localStorage if API fails
				const storedPreviousInputs = localStorage.getItem('previousInputs');
				if (storedPreviousInputs) {
					setTexts(JSON.parse(storedPreviousInputs));
				}
			} finally {
				setIsLoading(false);
			}
		};

		loadData();

		// 单用户模式 - 不需要订阅实时更新
	}, []);

	const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		const text = event.target.value;
		const lines = text.split('\n');
		const previousLines = texts;

		setTexts(lines);
		// Save to server-side storage
		saveSharedInputs(lines);

		// Sync responses with texts array using reduce - maintain correspondence between trackNo and results
		const nextResponses = lines.reduce((newResponses, currentLine) => {
			const previousIndex = previousLines.indexOf(currentLine);

			// If this line existed in the previous input and we have a result for it
			if (previousIndex !== -1 && previousIndex < responses.length) {
				newResponses.push(responses[previousIndex]);
			}

			return newResponses;
		}, [] as (TrackingResult | null)[]);

		setResponses(nextResponses);
		// 行序变化时同步重排逐行刷新错误，避免提示错位
		setRowErrors(
			lines.map((line) => {
				const previousIndex = previousLines.indexOf(line);
				return previousIndex !== -1 && previousIndex < rowErrors.length ? rowErrors[previousIndex] : null;
			}),
		);
		// Persist the re-aligned results so a reload keeps inputs and results in sync
		saveSharedResults(nextResponses);
	};

	const setRowError = useCallback((index: number, message: string | null) => {
		setRowErrors((current) => {
			const next = [...current];
			while (next.length <= index) next.push(null);
			next[index] = message;
			return next;
		});
	}, []);

	const setRefreshing = useCallback((index: number, refreshing: boolean) => {
		const next = new Set(refreshingRef.current);
		if (refreshing) {
			next.add(index);
		} else {
			next.delete(index);
		}
		refreshingRef.current = next;
		setRefreshingIndexes(next);
	}, []);

	const fetchData = async () => {
		try {
			const tmpList: (TrackingResult | null)[] = [];
			let pendingCount = texts.length;
			
			// First pass: check which track numbers are already delivered
			for (let i = 0; i < texts.length; i++) {
				const text = texts[i];
				const existingResult = responses[i];
				
				// Skip blank lines: no way bill code to query, but keep a placeholder
				// so that responses stays index-aligned with texts
				const wayBillCode = extractWayBillCode(text);
				if (!wayBillCode) {
					tmpList.push(null);
					pendingCount--;
					setCount(pendingCount);
					setResponses([...tmpList]);
					continue;
				}

				// Check if this track number has a delivered result
				if (existingResult && existingResult.data && existingResult.data.hisList && existingResult.data.hisList.length > 0) {
					const status = JSON.stringify(existingResult.data.hisList[0].toStatus);
					const isDelivered = status.includes('感谢使用');
					
					if (isDelivered) {
						// Keep the existing delivered result
						tmpList.push(existingResult);
						pendingCount--;
						setCount(pendingCount);
						setResponses([...tmpList]);
						continue;
					}
				}
				
				// Fetch data for non-delivered or new track numbers
				const response = await fetch(TRACK_ENDPOINT, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ wayBillCode }),
				});
				if (!response.ok) {
					throw new Error(`Request failed: ${response.status}`);
				}
				const data = await response.json();
				tmpList.push(data);
				pendingCount--;
				setResponses(tmpList);
				setCount(pendingCount);
				setError(null);				
				setHasFirstData(true);
			}
			if (texts.some((line) => line.trim())) {
				const now = Date.now();
				setLastUpdatedAt(now);
				await saveTrackingSnapshot(tmpList, now);
			}
		} catch (error: unknown) {
			setError(error instanceof Error ? error.message : 'Unknown errors');
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = () => {
		setLoading(true);
		setHasFirstData(false);
		fetchData();
	};

	// 单条刷新：只重新查询指定下标对应的运单号；
	// 成功才更新结果与「最后一次查询」时间，失败（含超时）保留原状态并在该行提示
	const handleRefreshOne = useCallback(
		async (index: number) => {
			if (refreshingRef.current.has(index)) return;
			const wayBillCode = extractWayBillCode(textsRef.current[index] ?? '');
			if (!wayBillCode) return;

			setRefreshing(index, true);
			setRowError(index, null);
			setError(null);

			// 超时保护：请求卡住时主动中断，给出可见的错误而不是永远转圈
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

			try {
				const response = await fetch(TRACK_ENDPOINT, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ wayBillCode }),
					signal: controller.signal,
				});
				if (!response.ok) {
					throw new Error(`请求失败：HTTP ${response.status}`);
				}
				const data = (await response.json()) as TrackingResult;
				// 查询已有结果就先停转：落库耗时不应拖住按钮
				setRefreshing(index, false);

				if (!data || data.result === false || !data.data || !data.data.hisList || data.data.hisList.length === 0) {
					// 未查到有效物流：保留原状态，只在该行提示
					setRowError(index, `刷新失败：${(data && data.msg) || '未查询到物流信息'}`);
					return;
				}

				const nextResponses = [...responsesRef.current];
				while (nextResponses.length <= index) {
					nextResponses.push(null);
				}
				nextResponses[index] = data;
				setResponses(nextResponses);
				setHasFirstData(true);

				const now = Date.now();
				setLastUpdatedAt(now);
				// 后台落库，不阻塞界面
				void saveTrackingSnapshot(nextResponses, now);
			} catch (error: unknown) {
				setRefreshing(index, false);
				const message = controller.signal.aborted
					? `请求超时（${REFRESH_TIMEOUT_MS / 1000} 秒），请稍后重试`
					: error instanceof Error
						? error.message
						: '未知错误';
				setRowError(index, `刷新失败：${message}，已保留原状态`);
				setError(`${wayBillCode} 刷新失败：${message}`);
			} finally {
				clearTimeout(timer);
				setRefreshing(index, false);
			}
		},
		[setRefreshing, setRowError],
	);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background p-4">
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
		<div className="min-h-screen bg-background p-4">
			<div className="container mx-auto max-w-7xl">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<Card className="lg:col-span-1">
						<CardHeader>
							<CardTitle>Track Numbers</CardTitle>
							<CardDescription>Enter tracking numbers to check their status</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<textarea
								value={texts.join('\n')}
								onChange={handleTextChange}
								rows={15}
								placeholder="Enter multiple lines of text..."
								className="w-full p-3 border border-input rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
							/>
							<Button
								onClick={handleSubmit}
								disabled={loading}
								className="w-full bg-blue-600 hover:bg-blue-700 text-white"
							>
								{loading ? (<span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...</span>) : 'Update'}
							</Button>
							{lastUpdatedAt !== null && (
								<p className="text-center text-xs text-muted-foreground">
									最后更新：{formatLastQueryTime(lastUpdatedAt)}
								</p>
							)}
							{error && (
								<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
									<p className="text-destructive text-sm">Error: {error}</p>
								</div>
							)}
							<p className="text-center text-sm text-muted-foreground">
								v26.11.25 • {texts.length} tracking numbers
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
								) : refreshingIndexes.size > 0 ? (
									<span className="inline-flex items-center">
										<Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在刷新 {refreshingIndexes.size} 条…
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
									errors={rowErrors}
									onRefresh={handleRefreshOne}
									refreshingIndexes={refreshingIndexes}
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
