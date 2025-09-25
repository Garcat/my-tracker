
interface Props {
    trackNo: string[];
    results: {
            data: {
                hisList: {
                    toStatus: string;
                    createDate: string;
                }[]
            }
        }[];    
}

const ResultList = ({trackNo, results}: Props) => {
    return (
        <ul>
            {results.map((result, index) => {
                // Only display if we have a valid result and corresponding trackNo
                if (result && result.data && result.data.hisList && result.data.hisList.length > 0 && index < trackNo.length) {
                    const status = JSON.stringify(result.data.hisList[0].toStatus);
                    const createDate = JSON.stringify(result.data.hisList[0].createDate);
                    return (
                        <li className="border border-gray-300 rounded p-2 m-2" key={index}>
                            {`${trackNo[index]}:   ${status} / ${createDate}`}
                        </li>
                    );
                }
                return null;
            })}
        </ul>
    )
}

export default ResultList