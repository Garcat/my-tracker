'use client';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ResultList from './resultList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
const App: React.FC = () => {
	const [texts, setTexts] = useState<string[]>([]);
	const [responses, setResponses] = useState<
		{ data: 
			{ 
				hisList: { toStatus: string; createDate: string }[],
				wbInfo: {expressCode: string}
			},
			msg: string,
			result: boolean
		}[]
	>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [hasFirstData, setHasFirstData] = useState(false);
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
		const previousLines = texts;
		
		setTexts(lines);
		localStorage.setItem('previousInputs', JSON.stringify(lines));
		
		// Sync responses with texts array using reduce - maintain correspondence between trackNo and results
		setResponses(prevResponses => {
			return lines.reduce((newResponses, currentLine) => {
				const previousIndex = previousLines.indexOf(currentLine);
				
				// If this line existed in the previous input and we have a result for it
				if (previousIndex !== -1 && previousIndex < prevResponses.length) {
					newResponses.push(prevResponses[previousIndex]);
				}
				
				return newResponses;
			}, [] as typeof prevResponses);
		});
	};

	const fetchData = async () => {
		try {
			const tmpList = [];
			let pendingCount = texts.length;
			
			// First pass: check which track numbers are already delivered
			for (let i = 0; i < texts.length; i++) {
				const text = texts[i];
				const existingResult = responses[i];
				
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
				const payload = { wayBillCode: text };
				const response = await axios.post(endpoint, payload, {
					headers: {
						Accept: '/',
						'Content-Type': 'application/json'
					}
				});
				tmpList.push(response.data);
				pendingCount--;
				setResponses(tmpList);
				setCount(pendingCount);
				setError(null);				
				setHasFirstData(true);
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

	return (
		<div className="min-h-screen bg-background p-4">
			<div className="container mx-auto max-w-7xl">
				<div className="mb-4">
					<iframe src="https://cors-anywhere.herokuapp.com/corsdemo" width="100%" height="120" className="rounded-lg" />
				</div>
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
								{loading ? (<span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...</span>) : 'Submit'}
							</Button>
							{error && (
								<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
									<p className="text-destructive text-sm">Error: {error}</p>
								</div>
							)}
							<p className="text-center text-sm text-muted-foreground">v11.19.17</p>
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
						</CardHeader>
						<CardContent>
							{!hasFirstData && loading ? (
								<div className="flex items-center justify-center py-8">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
									<span className="ml-2">Loading...</span>
								</div>
							) : (
								<ResultList trackNo={texts} results={responses} />
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};

export default App;
