
interface Props {
    trackNo: string[];
    results: {
            data: {
                hisList: {
                    toStatus: string;
                    createDate: string;
                }[],
                wbInfo: {
                    expressCode: string;
                }
            },
            msg: string,
            result: boolean
        }[];    
}

const ResultList = ({trackNo, results}: Props) => {
    console.log(results);
    return (
        <div className="space-y-3">
            {results.map((result, index) => {
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
                                <div className="font-medium text-md text-muted-foreground">
                                    {itemTitle}
                                </div>
                                <div className={`text-sm ${isDelivered ? 'text-destructive' : isInTransfer ? 'text-amber-600' : 'text-foreground'}`}>
                                    {status.replace(/"/g, '')}
                                </div>
                            </div>
                        </div>
                    );
                } else if (result && result.result === false) {
                    return (
                        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm border-gray-300" key={index}>
                            <div className="font-medium text-sm text-gray-300">{result.msg}</div>
                        </div>
                    );
                }
                return null;
            })}
        </div>
    )
}

export default ResultList