
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
                const status = JSON.stringify(result.data.hisList[0].toStatus);
                const createDate = JSON.stringify(result.data.hisList[0].createDate);
                return (
                    <li className="border border-gray-300 rounded p-2 m-2" key={index}>
                        {`${trackNo[index]}:   ${status} / ${createDate}`}
                    </li>
                );
            })}
        </ul>
    )
}

export default ResultList