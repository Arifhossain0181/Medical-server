const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { Server } = require("socket.io");
const { ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;
// Serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Configure multer for file uploads with proper extensions
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    // Keep original extension
    const ext = path.extname(file.originalname); // .png, .docx, etc.
    const uniqueName = Date.now() + "-" + file.fieldname + ext;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage: storage });

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
    const chatCollection = db.collection("chats"); 
    const docterorsCollection = db.collection("registerdoctors");

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

    // doctors registeration
   app.post('/register-doctor',upload.fields([
     { name: "license" },
    { name: "degrees" },
    { name: "idProof" },
    { name: "profilePhoto" },
   ]),
  async(req,res) =>{
    try{
      const doctorData = {
        ...req.body,
        files:req.files,
        status: "pending",
      createdAt: new Date(),
      };
      const result = await docterorsCollection.insertOne(doctorData);
      res.status(200).json({
        success: true,
        message: "Doctor registered successfully",
        doctorId: result.insertedId,
      });

    } catch (error) {
      console.error("Error registering doctor:", error);
      res.status(500).send({ message: 'Internal server error' });
    }
  })


  // all the doctors here registered

  app.get('/register-doctors-all', async (req, res) => {
    try {
      const doctors = await docterorsCollection.find().sort({ createdAt: -1 }).toArray();
      res.status(200).json(doctors);
    } catch (error) {
      console.error("Error fetching registered doctors:", error);
      res.status(500).send({ message: 'Internal server error' });
    }
  })

  // approve or reject doctor registration
  app.patch('/register-doctors-status/:id', async (req, res) => {
    try{
      const {id} = req.params;
      const {status} = req.body;
      if(!['approved','rejected'].includes(status)){
        return res.status(400).json({message: 'Invalid status value'});
      }
      const result = await docterorsCollection.updateOne({_id: new ObjectId(id)},
    {$set: {status, updatedAt: new Date()}});
    if(result.modifiedCount === 0){
      res.status(200).json({message: 'Doctor status updated successfully'});
    }
    }
    catch (error) {
      console.error("Error updating doctor status:", error);
      res.status(500).send({ message: 'Internal server error' });
    }


  })









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
