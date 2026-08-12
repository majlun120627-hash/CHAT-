const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const users = new Map();
const messages = new Map();
const blocked = new Map();
const reports = [];

function getMessages(a, b) {
  const key = [a, b].sort().join(":");

  if (!messages.has(key)) {
    messages.set(key, []);
  }

  return messages.get(key);
}

function isBlocked(a, b) {
  return (
    blocked.get(a)?.has(b) ||
    blocked.get(b)?.has(a)
  );
}


/* REGISTER */

app.post("/api/register", (req, res) => {

  const { username, age } = req.body;

  if (!username || !age) {
    return res.status(400).json({
      error: "Username and age are required."
    });
  }

  if (Number(age) < 13) {
    return res.status(403).json({
      error: "CHAT! is 13+."
    });
  }

  if (users.has(username)) {
    return res.status(409).json({
      error: "Username already exists."
    });
  }

  users.set(username, {
    username,
    age: Number(age),
    online: false
  });

  res.json({
    success: true,
    username
  });
});


/* USERS */

app.get("/api/users", (req, res) => {

  res.json(
    [...users.values()].map(user => ({
      username: user.username,
      online: user.online
    }))
  );

});


/* BLOCK */

app.post("/api/block", (req, res) => {

  const { username, target } = req.body;

  if (!username || !target) {
    return res.status(400).json({
      error: "Missing user."
    });
  }

  if (!blocked.has(username)) {
    blocked.set(username, new Set());
  }

  blocked.get(username).add(target);

  res.json({
    success: true
  });

});


/* REPORT */

app.post("/api/report", (req, res) => {

  const {
    reporter,
    reported,
    reason
  } = req.body;

  if (!reporter || !reported || !reason) {
    return res.status(400).json({
      error: "Missing report information."
    });
  }

  reports.push({
    reporter,
    reported,
    reason,
    time: new Date().toISOString()
  });

  console.log("NEW REPORT:", reports.at(-1));

  res.json({
    success: true
  });

});


/* SOCKET.IO */

io.on("connection", socket => {

  console.log("User connected:", socket.id);


  socket.on("login", username => {

    if (!users.has(username)) {
      return;
    }

    users.get(username).online = true;

    socket.username = username;

    socket.join(username);

    io.emit(
      "users:update",
      [...users.values()]
    );

  });


  socket.on(
    "message",
    ({ to, text }) => {

      const from = socket.username;

      if (!from || !to || !text) {
        return;
      }

      if (isBlocked(from, to)) {
        return;
      }

      const message = {
        from,
        to,
        text,
        time: Date.now()
      };

      getMessages(from, to).push(message);

      io.to(to).emit(
        "message",
        message
      );

      socket.emit(
        "message",
        message
      );

    }
  );


  socket.on("disconnect", () => {

    if (socket.username &&
        users.has(socket.username)) {

      users.get(socket.username).online = false;

      io.emit(
        "users:update",
        [...users.values()]
      );

    }

  });

});


app.get("*", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );

});


const PORT =
  process.env.PORT || 3000;

server.listen(PORT, () => {

  console.log(
    `CHAT! running on port ${PORT}`
  );

});
