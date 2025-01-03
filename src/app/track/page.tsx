'use client';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ResultList from './resultList';
const App: React.FC = () => {
	const [texts, setTexts] = useState<string[]>([]);
	// const [responses, setResponses] = useState<unknown[]>([]);
	const [responses, setResponses] = useState<
		{ data: { hisList: { toStatus: string; createDate: string }[] } }[]
	>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [count, setCount] = useState(0);

	const cors_api_host = 'cors-anywhere.herokuapp.com';
	const cors_api_url = 'https://' + cors_api_host + '/';
	const endpoint =
		cors_api_url + 'http://sys-new-api.auodexpress.com/api/tms/userSys/client/getRouterList';

	useEffect(() => {
		const storedPreviousInputs = localStorage.getItem('previousInputs');
		if (storedPreviousInputs) {
			setTexts(JSON.parse(storedPreviousInputs));
		}
	}, []);

	const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		const text = event.target.value;
		const lines = text.split('\n');
		setTexts(lines);
		localStorage.setItem('previousInputs', JSON.stringify(lines));
	};

	const fetchData = async () => {
		try {
			const tmpList = [];
			setCount(texts.length);
			for (const text of texts) {
				const payload = { wayBillCode: text };
				const response = await axios.post(endpoint, payload, {
					headers: {
						Accept: '/',
						'Content-Type': 'application/json'
					}
				});
				tmpList.push(response.data);
				setResponses(tmpList);
				setCount(prev => prev - 1);
				setLoading(false);
			}
		} catch (error: unknown) {
			setError(error instanceof Error ? error.message : 'Unknown errors');
		}
	};

	const handleSubmit = () => {
		setLoading(true);
		fetchData();
	};

	return (
		<div className="flex flex-col">
			<iframe src="https://cors-anywhere.herokuapp.com/corsdemo" width="100%" height="120" />
			<div className="flex">
				<div className="flex flex-col w-40 m-4">
					<h2>Track No.:</h2>
					<textarea
						value={texts.join('\n')}
						onChange={handleTextChange}
						rows={16}
						cols={20}
						placeholder="Enter multiple lines of text..."
						className="border border-gray-300 rounded p-2"
					/>
					<button
						onClick={handleSubmit}
						className="bg-blue-500 hover:bg-blue-700 text-white font-bold m-2 py-2 px-4 rounded"
					>
						Submit
					</button>
					{error ? <p className="text-red-500">Error: {error}</p> : null}
				</div>
				<div className="flex flex-col w-160 m-4">
					<h2>Status: {count} updates left</h2>
					{loading ? (
						<p>Loading...</p>
					) : (
						<ResultList trackNo={texts} results={responses} />
					)}
				</div>
			</div>
		</div>
	);
};

export default App;
