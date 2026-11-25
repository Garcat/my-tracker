'use client';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { TrackingResult } from '@/types/tracking';

interface Props {
    trackNo: string[];
    results: (TrackingResult | null)[];
    /** 与 results 按下标对齐的逐行刷新错误提示 */
    errors?: (string | null)[];
    onRefresh?: (index: number) => void;
    refreshingIndexes?: Set<number>;
    disabled?: boolean;
}

interface RefreshButtonProps {
    index: number;
    onRefresh?: (index: number) => void;
    refreshingIndexes?: Set<number>;
    disabled?: boolean;
}

// 单条刷新按钮：每条结果行共用，刷新中显示旋转图标，未传 onRefresh 时不渲染
const RefreshButton = ({index, onRefresh, refreshingIndexes, disabled}: RefreshButtonProps) => {
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
}

const ResultList = ({trackNo, results, errors, onRefresh, refreshingIndexes, disabled}: Props) => {
    return (
        <div className="space-y-3">
            {results.map((result, index) => {
                const rowError = errors?.[index] ?? null;
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
                            <div className={`flex ${isDelivered || isInTransfer ? 'flex-col' : 'flex-row items-baseline space-x-2'} space-y-1`}>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-md text-muted-foreground">
                                        {itemTitle}
                                    </div>
                                    <div className={`text-sm ${isDelivered ? 'text-destructive' : isInTransfer ? 'text-amber-600' : 'text-foreground'}`}>
                                        {status.replace(/"/g, '')}
                                    </div>
                                    {rowError && (
                                        <div className="text-sm text-destructive">{rowError}</div>
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
                } else if (result && result.result === false) {
                    return (
                        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm border-gray-300" key={index}>
                            <div className="flex flex-row items-baseline space-x-2">
                                <div className="flex-1 min-w-0">
                                    {index < trackNo.length && (
                                        <div className="font-medium text-sm text-muted-foreground">{trackNo[index]}</div>
                                    )}
                                    <div className="font-medium text-sm text-gray-300">{result.msg}</div>
                                    {rowError && (
                                        <div className="text-sm text-destructive">{rowError}</div>
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
                } else if (rowError) {
                    // 没有可展示的结果但刷新失败：单独提示，避免静默失败
                    return (
                        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm border-destructive/50 bg-destructive/5" key={index}>
                            <div className="flex flex-row items-baseline space-x-2">
                                <div className="flex-1 min-w-0">
                                    {index < trackNo.length && (
                                        <div className="font-medium text-sm text-muted-foreground">{trackNo[index]}</div>
                                    )}
                                    <div className="text-sm text-destructive">{rowError}</div>
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