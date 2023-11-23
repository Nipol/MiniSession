const wsUrl =
  "ws://magical_jang.orb.local/ws/a8604c0f90ee719618a6ced56b27038f9f453436d56cf826fbed4bb342efe766/0x1234567890USER";
let socket = null;

window.addEventListener("load", function () {
  const statusDiv = document.getElementById("status");
  const messagesList = document.getElementById("messages");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");

  socket = new WebSocket(wsUrl);

  socket.onopen = function (event) {
    console.log("Connected to WebSocket server.");
    statusDiv.textContent = "Connected";
  };

  socket.onmessage = function (event) {
    // pong
    if (event.data.length === 1 && event.data == a) return;

    console.log("Received message:", event.data);
    const li = document.createElement("li");
    li.textContent = event.data;
    messagesList.appendChild(li);
  };

  socket.onclose = function (event) {
    console.log("Disconnected from WebSocket server.");
    statusDiv.textContent = "Disconnected";
  };

  socket.onerror = function (event) {
    console.error("WebSocket error:", event);
    statusDiv.textContent = "Error";
  };

  messageForm.onsubmit = function (event) {
    event.preventDefault();
    if (socket.readyState === WebSocket.OPEN) {
      const message = messageInput.value;
      socket.send(message);
      console.log("Sent message:", message);
      messageInput.value = "";
    } else {
      console.error("WebSocket is not connected.");
    }
  };

  // ping
  this.setInterval(() => {
    socket.send(0x9);
  }, 50000);
});
