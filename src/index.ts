import { Hono } from 'hono';
import { env } from 'cloudflare:workers';
import { streamText } from 'hono/streaming';
import { events } from 'fetch-event-stream';

const app = new Hono<{ Bindings: Env }>();

/**
 * Converts a base64 image to a Uint8Array
 */
async function base64ToUint8Array(base64Image: string): Promise<number[]> {
	// Remove data URL prefix if present
	const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

	// Create a Blob from the base64 data
	const byteCharacters = atob(base64);
	const byteArrays = [];

	for (let offset = 0; offset < byteCharacters.length; offset += 512) {
		const slice = byteCharacters.slice(offset, offset + 512);
		const byteNumbers = new Array(slice.length);

		for (let i = 0; i < slice.length; i++) {
			byteNumbers[i] = slice.charCodeAt(i);
		}

		byteArrays.push(new Uint8Array(byteNumbers));
	}

	const blob = new Blob(byteArrays);

	// Convert Blob to ArrayBuffer, then to Uint8Array
	const arrayBuffer = await blob.arrayBuffer();
	return [...new Uint8Array(arrayBuffer)];
}

app.get('/check-prompt', async (c) => {
	const results = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
		prompt: 'Say hello world in 5 languages',
	});
	return c.json(results);
});

app.get('/check-prompt-stream', async (c) => {
	const resultsStream = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
		prompt: 'Say hello world in 5 languages',
		stream: true,
	});
	c.header('Content-Encoding', 'Identity');
	return streamText(c, async (stream) => {
		const chunks = events(new Response(resultsStream as ReadableStream));
		for await (const chunk of chunks) {
			if (chunk.data && chunk.data === '[DONE]') {
				break;
			}
			const data = JSON.parse(chunk.data as string);
			const token = data.choices[0]?.text;
			if (token) {
				stream.write(token);
			}
		}
	});
});

app.post('/understand', async (c) => {
	const payload = await c.req.json();

	if (!payload.prompt || !payload.imageUrl) {
		return c.json({ error: 'Missing prompt or imageUrl' }, 400);
	}

	// Using imageUrl directly
	const resultStream = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: payload.prompt,
					},
					{
						type: 'image_url',
						image_url: {
							url: payload.imageUrl,
						},
					},
				],
			},
		],
		stream: true,
	});
	c.header('Content-Encoding', 'Identity');
	return streamText(c, async (stream) => {
		const chunks = events(new Response(resultStream as ReadableStream));
		for await (const chunk of chunks) {
			if (chunk.data !== undefined && chunk.data !== '[DONE]') {
				const data = JSON.parse(chunk.data);
				const token = data.choices[0]?.text;
				if (token) {
					stream.write(token);
				}
			}
		}
	});
});

export default app;
