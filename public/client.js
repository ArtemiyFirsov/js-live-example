const captions = window.document.getElementById("captions");

async function getMicrophone() {
  const userMedia = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  return new MediaRecorder(userMedia);
}

async function openMicrophone(microphone, socket) {
  await microphone.start(500);

  microphone.onstart = () => {
    console.log("client: microphone opened");
    document.body.classList.add("recording");
  };

  microphone.onstop = () => {
    console.log("client: microphone closed");
    document.body.classList.remove("recording");
  };

  microphone.ondataavailable = (e) => {
    const data = e.data;
    console.log("client: sent data to websocket");
    socket.send(data);
  };
}

async function closeMicrophone(microphone) {
  microphone.stop();
}

async function start(socket) {
  const listenButton = document.getElementById("record");
  let microphone;

  console.log("client: waiting to open microphone");

  listenButton.addEventListener("click", async () => {
    if (!microphone) {
      // open and close the microphone
      microphone = await getMicrophone();
      await openMicrophone(microphone, socket);
    } else {
      await closeMicrophone(microphone);
      microphone = undefined;
    }
  });
}

async function getTempApiKey() {
  const result = await fetch("/key");
  const json = await result.json();

  return json.key;
}

const openAIKey = '...';
const model = "gpt-3.5-turbo"; 


async function getChatGPTResponse(prompt){
  const requestOptions = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIKey}`
    },
    body: JSON.stringify({
        model: model,
        messages: [{"role": "user", "content": prompt}],
        temperature: 0.7,
        max_tokens: 60,
        n: 1,
        stop: null,
    }),
};

  const result = await fetch('https://api.openai.com/v1/chat/completions', requestOptions);
  const json = await result.json();

  return json;
}


window.addEventListener("load", async () => {
  const key = await getTempApiKey();

  const { createClient } = deepgram;

  const _deepgram = createClient(key);

  const socket = _deepgram.listen.live({ model: "nova", smart_format: true });

  socket.on("open", async () => {
    console.log("client: connected to websocket");

    socket.on("Results", (data) => {
      console.log(data);

      const is_final = data.is_final;
      const transcript = data.channel.alternatives[0].transcript;

      if (transcript.length && !!is_final){
        captions.innerHTML = transcript ? `<span>${transcript}</span>` : "";
        getChatGPTResponse(transcript).then(res => {
          console.log(res.choices[0].message.content);
        });
      }
    });

    socket.on("error", (e) => console.error(e));

    socket.on("warning", (e) => console.warn(e));

    socket.on("Metadata", (e) => console.log(e));

    socket.on("close", (e) => console.log(e));

    await start(socket);
  });
});
