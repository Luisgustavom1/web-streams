import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http'
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Transform, Writable } from 'node:stream';
import byteSize from 'byte-size';
import csvtojson from 'csvtojson';
import { TransformStream } from 'node:stream/web';
import { setTimeout } from 'node:timers/promises'

const PORT = 3000
let currentPosition = 0;

createServer(async (req, res) => {
    const headers = {
        'Access-Control-Allow-Origin': "*",
        'Access-Control-Allow-Methods': "*",
    }

    if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return;
    }

    let counter = 0;
    const root = path.dirname(fileURLToPath(import.meta.url));
    const filename = path.join(root, '/data/animeflv.csv');
    const { size } = await stat(filename);
    console.log('processing ', byteSize(size).toString());
    
    try {
        res.writeHead(200, headers);

        const abortController = new AbortController();
        req.once('close', () => {
            console.log("Connection was closed!", counter);
            abortController.abort();
        });

        const readStream = createReadStream(filename, { start: currentPosition })
        await Readable.toWeb(readStream)
        .pipeThrough(
            Transform.toWeb(csvtojson({
                headers: ['title', 'description', 'year', 'type', 'rate_start', 'votes', 'status', 'followers', 'episodes', 'genders', 'url_anime', 'image']
            }))
        )
        .pipeThrough(
            new TransformStream({
                async transform(jsonLine, controller) {
                    const data = JSON.parse(Buffer.from(jsonLine));
                    const message = JSON.stringify({
                        title: data.title,
                        description: data.description,
                        url: data.url_anime         
                    }).concat("\n");
                    counter++;
                    await setTimeout(1000);
                    controller.enqueue(message);
                    const lineBytesLength = Buffer.from(Object.values(data).join(',') + "\n").length + 1;
                    currentPosition += lineBytesLength;
                }
            })
        )
        .pipeTo(
            Writable.toWeb(res),
            {
                signal: abortController.signal,
            }
        )
    } catch (error) {
        if (error.message.includes("abort")) return;
        console.log("Something happened", error);
    }
})
.listen(PORT)
.on("listening", () => console.log("Server is running at", PORT));