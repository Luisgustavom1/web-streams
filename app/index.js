const API_URL = "http://localhost:3000";

async function consumeData(signal) {
    const response = await fetch(API_URL, {
        signal
    });

    const reader = response.body
        .pipeThrough(
            new TextDecoderStream()
        )
        .pipeThrough(
            parseNDJSON()
        )
    
    return reader;
}

function parseNDJSON() {
    return new TransformStream({
        transform(chunk, controller) {
            for (const item of chunk.split("\n")) {
                if (!item.length) continue;
                try {
                    controller.enqueue(JSON.parse(item));
                } catch (err) {
                    // Its common the arrived data is not completed 
                    // 1st {"name": "lu
                    // 2st is"}\n 
                    // result {"name": "luis"}\n
                }
            }
        }
    })
}

let counter = 0;
let elementCounter = 0;
function appendToHtml(el) {
    return new WritableStream({
        write({ title, description, url }) {
            const card = `
            <article class='card'>
                <h3>${++counter} - ${title}</h3>
                <p>${description}</p>
                <a class='link' href="${url}">See more</a>
            </article>
            `;

            if (++elementCounter > 20) {
                el.innerHTML = card;
                elementCounter = 0;
                return;
            }

            el.innerHTML += card;
        },
        abort(reason) {
            console.log("Aborted", reason);
        }
    });
}

const [
    start, 
    stop,
    cardsContainer
] = ["start", "stop", "cards"].map(id => document.getElementById(id))

let abortController = new AbortController();
start.addEventListener('click', async () => {
    try {
        const reader = await consumeData(abortController.signal)
        await reader.pipeTo(appendToHtml(cards), { signal: abortController.signal })
    } catch (error) {
        if (!error.message.includes("abort")) throw error;
        console.log("Something happened", error);
    }
})
stop.addEventListener('click', async () => {
    abortController.abort();
    console.log("aborting...");
    abortController = new AbortController();
})

