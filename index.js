const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // React URL
    methods: ["GET", "POST"],
  },
});

// MongoDB setup
const uri = `mongodb+srv://${process.env.USER_BD}:${process.env.PASS_BD}@co.sb0kq7l.mongodb.net/?retryWrites=true&w=majority&appName=Co`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// Track online users
let onlineUsers = new Map();

async function run() {
  try {
    await client.connect();
    const db = client.db("Madical");

    const doctorscollection = db.collection("doctors");
    const servicscollection = db.collection("service");
    const mycarcollection = db.collection("mycart");
    const chatCollection = db.collection("chats"); // New collection for messages

    // ========== REST APIs ==========

    app.get("/doctors", async (req, res) => {
      const doctors = await doctorscollection.find().toArray();
      res.send(doctors);
    });

    app.get("/doctors/:id", async (req, res) => {
      const id = Number(req.params.id);
      const doctor = await doctorscollection.findOne({ id });
      res.send(doctor);
    });

    app.get("/service", async (req, res) => {
      const services = await servicscollection.find().toArray();
      res.send(services);
    });

    app.get("/mycart", async (req, res) => {
      const result = await mycarcollection.find().toArray();
      res.send(result);
    });

    app.post("/mycart", async (req, res) => {
      const cart = req.body;
      const result = await mycarcollection.insertOne(cart);
      res.send(result);
    });

    app.delete("/mycart/:id", async (req, res) => {
      const id = req.params.id;
      const result = await mycarcollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

   // GET chat history with pagination
app.get("/chat/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  const page = parseInt(req.query.page) || 0; 
  const limit = parseInt(req.query.limit) || 20; 

  const messages = await chatCollection
    .find({
      $or: [
        { senderId: user1, receiverId: user2 },
        { senderId: user2, receiverId: user1 },
      ],
    })
    .sort({ timestamp: -1 })
    .skip(page * limit)
    .limit(limit)
    .toArray();

  res.send(messages.reverse()); 
});


    // Socket.io real-time chat
    io.on("connection", (socket) => {
      console.log(" User connected:", socket.id);

      socket.on("join", (userId) => {
        onlineUsers.set(userId, socket.id);
        console.log(`User joined: ${userId}`);
      });

      socket.on("send_message", async (data) => {
        const { senderId, receiverId, message } = data;
        const receiverSocket = onlineUsers.get(receiverId);

        // Save message to DB
        await chatCollection.insertOne({ senderId, receiverId, message, timestamp: new Date() });

        // Send to receiver in real-time
        if (receiverSocket) {
          io.to(receiverSocket).emit("receive_message", { senderId, message });
        }
      });

      socket.on("disconnect", () => {
        console.log(" User disconnected:", socket.id);
        for (let [key, value] of onlineUsers.entries()) {
          if (value === socket.id) onlineUsers.delete(key);
        }
      });
    });

    // Test route
    app.get("/", (req, res) => {
      res.send("Medical Appointment API Running...");
    });

    console.log(" Backend ready with MongoDB & Socket.io!");
  } finally {
    // keep client alive
  }
}
run().catch(console.dir);

server.listen(port, () => {
  console.log(` Server running on port ${port}`);
});
