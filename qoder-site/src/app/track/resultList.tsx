'use client';
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { ParcelInfo, ParcelMap, TrackingResult } from '@/types/tracking';

interface Props {
    trackNo: string[];
    results: (TrackingResult | null)[];
    /** 与 results 按下标对齐的逐行错误信息 */
    errors?: (string | null)[];
    /** 运单号 -> 包裹内容，来自「澳德回国」表格 */
    parcels?: ParcelMap;
    /** 保存单个运单的包裹信息，返回是否成功 */
    onSaveParcel?: (code: string, parcel: ParcelInfo) => Promise<boolean>;
    /** 单独刷新某一行运单的物流状态 */
    onRefresh?: (index: number) => void;
    /** 正在刷新中的行下标集合 */
    refreshingIndexes?: Set<number>;
    /** 批量查询进行中时禁用单条刷新 */
    disabled?: boolean;
}

// 输入行首个空格/Tab 前是运单号，其余是附加说明
function wayBillCodeOf(line: string): string {
    return line.trim().split(/\s+/)[0] ?? '';
}

interface RefreshButtonProps {
    index: number;
    onRefresh?: (index: number) => void;
    refreshingIndexes?: Set<number>;
    disabled?: boolean;
}

// 单条刷新按钮：每条结果行共用，刷新中显示旋转图标
const RefreshButton = ({ index, onRefresh, refreshingIndexes, disabled }: RefreshButtonProps) => {
    if (!onRefresh) return null;
    const isRefreshing = refreshingIndexes?.has(index) ?? false;
    return (
        <Button
            variant="ghost"
            size="sm"
            className="shrink-0 -mt-1 -mr-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title="刷新此单号状态"
            aria-label="刷新此单号状态"
            disabled={isRefreshing || disabled}
            onClick={() => onRefresh(index)}
        >
            {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <RefreshCw className="h-4 w-4" />
            )}
        </Button>
    );
};

interface ParcelBlockProps {
    code: string;
    parcel: ParcelInfo | null;
    onSaveParcel?: (code: string, parcel: ParcelInfo) => Promise<boolean>;
}

type ParcelField = 'eta' | 'content';

// 包裹信息展示：预计到达与包裹内容各自独立编辑
const ParcelBlock = ({code, parcel, onSaveParcel}: ParcelBlockProps) => {
    const [editing, setEditing] = useState<ParcelField | null>(null);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const savingRef = useRef(false);
    const content = parcel?.content?.trim() ?? '';
    const eta = parcel?.eta?.trim() ?? '';

    const startEdit = (field: ParcelField) => {
        if (saving) return;
        setDraft(field === 'eta' ? (parcel?.eta ?? '') : (parcel?.content ?? ''));
        setSaveError(null);
        setEditing(field);
    };

    const cancelEdit = () => {
        setEditing(null);
        setSaveError(null);
    };

    const save = async (field: ParcelField) => {
        if (savingRef.current || !onSaveParcel) return;
        const text = draft.trim();
        const current = (field === 'eta' ? parcel?.eta : parcel?.content)?.trim() ?? '';
        // 内容没有变化：不触发写库，直接关闭编辑
        if (text === current) {
            setEditing(null);
            setSaveError(null);
            return;
        }
        savingRef.current = true;
        // 只更新当前字段，保留同一运单的地址、另一字段等信息
        const next: ParcelInfo = { ...(parcel ?? {}) };
        if (text) {
            next[field] = text;
        } else {
            delete next[field];
        }
        setSaving(true);
        setSaveError(null);
        const ok = await onSaveParcel(code, next);
        savingRef.current = false;
        setSaving(false);
        if (ok) {
            setEditing(null);
        } else {
            setSaveError('保存失败，请重试');
        }
    };

    return (
        <div className="mt-2 space-y-1">
            {editing === 'eta' ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>预计到达</span>
                    <input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => {
                            void save('eta');
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void save('eta');
                            }
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                cancelEdit();
                            }
                        }}
                        autoFocus
                        disabled={saving}
                        maxLength={20}
                        placeholder="如 11.14"
                        className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    />
                    <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={cancelEdit}
                        disabled={saving}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                    >
                        取消
                    </button>
                    {saving && <span>保存中…</span>}
                    {saveError && <span className="text-destructive">{saveError}</span>}
                </div>
            ) : (
                (eta || onSaveParcel) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {eta ? (
                            <span>预计到达：{eta}</span>
                        ) : (
                            <span className="italic">未设置预计到达</span>
                        )}
                        {onSaveParcel && (
                            <button
                                type="button"
                                onClick={() => startEdit('eta')}
                                className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            >
                                {eta ? '编辑' : '添加'}
                            </button>
                        )}
                    </div>
                )
            )}

            {editing === 'content' ? (
                <div className="space-y-2">
                    <label className="block text-xs text-muted-foreground">
                        包裹内容
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => {
                                void save('content');
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelEdit();
                                }
                            }}
                            autoFocus
                            disabled={saving}
                            rows={3}
                            maxLength={500}
                            placeholder="输入包裹内容…"
                            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                        />
                    </label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={cancelEdit}
                            disabled={saving}
                            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                        >
                            取消
                        </button>
                        {saving && <span>保存中…</span>}
                        {saveError && <span className="text-destructive">{saveError}</span>}
                    </div>
                </div>
            ) : (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    {content ? (
                        <span className="whitespace-pre-wrap break-words">包裹内容：{content}</span>
                    ) : (
                        <span className="italic">暂无包裹内容</span>
                    )}
                    {onSaveParcel && (
                        <button
                            type="button"
                            onClick={() => startEdit('content')}
                            className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                            {content ? '编辑' : '添加'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const ResultList = ({trackNo, results, errors, parcels, onSaveParcel, onRefresh, refreshingIndexes, disabled}: Props) => {
    return (
        <div className="space-y-3">
            {results.map((result, index) => {
                const trackLabel = index < trackNo.length ? trackNo[index] : '';
                const rowError = errors?.[index] ?? null;
                const code = wayBillCodeOf(trackLabel);
                const parcel = code ? parcels?.[code] ?? null : null;

                // 查询失败：在对应行标出错误；若保留了上次结果，一并显示
                if (rowError) {
                    const lastStatus = result && result.data && result.data.hisList && result.data.hisList.length > 0
                        ? JSON.stringify(result.data.hisList[0].toStatus).replace(/"/g, '')
                        : '';
                    return (
                        <div
                            className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm border-destructive/50 bg-destructive/5"
                            key={index}
                        >
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="font-medium text-md text-muted-foreground">
                                        {trackLabel}
                                    </div>
                                    <div className="text-sm text-destructive">
                                        查询失败：{rowError}
                                    </div>
                                    {lastStatus && (
                                        <div className="text-sm text-muted-foreground">
                                            上次状态：{lastStatus}
                                        </div>
                                    )}
                                    {code && (
                                        <ParcelBlock code={code} parcel={parcel} onSaveParcel={onSaveParcel} />
                                    )}
                                </div>
                                <RefreshButton
                                    index={index}
                                    onRefresh={onRefresh}
                                    refreshingIndexes={refreshingIndexes}
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    );
                }

                // Only display if we have a valid result and corresponding trackNo
                if (result && result.data && result.data.hisList && result.data.hisList.length > 0 && index < trackNo.length) {
                    const status = JSON.stringify(result.data.hisList[0].toStatus);
                    const createDate = JSON.stringify(result.data.hisList[0].createDate);
                    const isInTransfer = status.includes('您的快件') || status.includes('派件');
                    const isDelivered = status.includes('感谢使用');
                    let itemTitle = trackNo[index] + ' / ' + createDate.replace(/"/g, '');
                    if (isDelivered || isInTransfer) {
                        itemTitle = itemTitle + ' / ' + JSON.stringify(result.data.wbInfo.expressCode);
                    }
                    return (
                        <div 
                            className={`p-4 rounded-lg border bg-card text-card-foreground shadow-sm
                                ${isDelivered ? 'border-destructive/50 bg-destructive/5' : 
                                  isInTransfer ? 'border-amber-500/50 bg-amber-50/50' : 
                                  'border-border'}`} 
                            key={index}
                        >
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className={`flex ${isDelivered || isInTransfer ? 'flex-col' : 'flex-row items-baseline space-x-2'} space-y-1`}>
                                        <div className="font-medium text-md text-muted-foreground">
                                            {itemTitle}
                                        </div>
                                        <div className={`text-sm ${isDelivered ? 'text-destructive' : isInTransfer ? 'text-amber-600' : 'text-foreground'}`}>
                                            {status.replace(/"/g, '')}
                                        </div>
                                    </div>
                                    {code && (
                                        <ParcelBlock code={code} parcel={parcel} onSaveParcel={onSaveParcel} />
                                    )}
                                </div>
                                {onRefresh && (
                                    <RefreshButton
                                        index={index}
                                        onRefresh={onRefresh}
                                        refreshingIndexes={refreshingIndexes}
                                        disabled={disabled}
                                    />
                                )}
                            </div>
                        </div>
                    );
                } else if (result && result.result === false) {
                    return (
                        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm border-gray-300" key={index}>
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-300">{result.msg}</div>
                                    {code && (
                                        <ParcelBlock code={code} parcel={parcel} onSaveParcel={onSaveParcel} />
                                    )}
                                </div>
                                <RefreshButton
                                    index={index}
                                    onRefresh={onRefresh}
                                    refreshingIndexes={refreshingIndexes}
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    );
                }
                return null;
            })}
        </div>
    )
}

export default ResultList