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

   
    const servicscollection = db.collection("service");
    const mycarcollection = db.collection("mycart");
    const chatCollection = db.collection("chats"); 
    const docterorsCollection = db.collection("registerdoctors");
    const AppointmentCollection = db.collection("appointments");

    // ========== REST APIs ==========

   

   

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

  // GET all approved doctors
  app.get('/register-doctors-approved',async(req,res) =>{
    try{
      const {search} = req.query;
      const query = {status: 'approved'};
      if(search){
        query.fullname ={ $regex: search, $options: 'i' };
      }
      const approvedDoctors = await docterorsCollection.find(query).sort({ createdAt: -1 }).toArray();
      if(!approvedDoctors.length){
        return res.status(404).json({message: 'No approved doctors found'});
      }
      res.status(200).json(approvedDoctors);
    }
     catch (error) {
    console.error("Error fetching approved doctors:", error);
    res.status(500).send({ message: "Failed to fetch approved doctors." });
  }
  });

  // Get all rejected doctors
  app.get('/register-doctors-rejected',async(req,res) =>{
    try{
      
      const {search} = req.query;
      const query = {status: 'rejected'};
      if(search){
        query.fullname ={ $regex: search, $options: 'i' };
      }

      const rejectedDoctors = await docterorsCollection.find(query).sort({ createdAt: -1 }).toArray();
      if(!rejectedDoctors.length){
        return res.status(404).json({message: 'No rejected doctors found'});
      }
      res.status(200).json(rejectedDoctors);
    }
    catch (error) {
      console.error("Error fetching rejected doctors:", error);
      res.status(500).send({ message: "Failed to fetch rejected doctors." });
    }

  })

  // delet a registered doctor
  app.delete('/register-doctors/:id',async(req,res) =>{
    try{
      const {id} = req.params;
      const deleltedoctor = await docterorsCollection.deleteOne({_id: new ObjectId(id)});
      if(deleltedoctor.deletedCount === 0){
        return res.status(404).json({message: 'Doctor not found'});
      }
      res.status(200).json({message: 'Doctor deleted successfully'});
    }
    catch (error) {
      console.error("Error deleting doctor:", error);
      res.status(500).send({ message: 'Internal server error' });
    }
  })
  // GET single doctor by ID
app.get("/register-doctors/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid doctor ID" });
    }

    const doctor = await docterorsCollection.findOne({ _id: new ObjectId(id) });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json(doctor);
  } catch (error) {
    console.error("Error fetching doctor:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
// // Get all unique specializations from approved doctors
 app.get('/approved-doctors-specializations', async (req, res) => {
  try {
    const pipeline =[
      { $match: { status: 'approved' } },
      {$group: {
          _id: "$specialization",
          count: { $sum: 1 },
        },

      },
      { $sort :{count: -1}}
    ];
    const result = await docterorsCollection.aggregate(pipeline).toArray();
    const specializations = result.map(item => ({
      specialization: item._id,
      count: item.count,
    }));
    res.status(200).json(specializations);
  }
  catch (error) {
    console.error("Error fetching specializations:", error);
    res.status(500).send({ message: 'Internal server error' });
  }

 });



 // POST appointments
 app.post('/appointments', async (req, res) => {
  const { doctorId, patientName, patientId, appointmentDate, time, reason } = req.body;
  
  try {
    // Log received data for debugging
    console.log('Received appointment data:', req.body);

    // Validate required fields
    if (!doctorId || !patientName || !appointmentDate) {
      console.log('Missing fields - doctorId:', doctorId, 'patientName:', patientName, 'appointmentDate:', appointmentDate);
      return res.status(400).json({ 
        message: "Missing required fields",
        received: { doctorId, patientName, appointmentDate }
      });
    }

    // Get doctor details
    const doctor = await docterorsCollection.findOne({ 
      _id: new ObjectId(doctorId),
      status: 'approved' 
    });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found or not approved" });
    }
// Check if this email already booked an appointment with this doctor on this date
const existingEmailAppointment = await AppointmentCollection.findOne({
  doctorId,
  date: appointmentDate,
  patientEmail: patientEmail,
});

if (existingEmailAppointment) {
  return res.status(400).json({ message: "You already have an appointment on this date with this doctor." });
}

// Count existing appointments for this doctor on this date
const existingCount  = await AppointmentCollection.countDocuments({
  doctorId,
  date: appointmentDate,
  status: "confirmed",
    });
    const doctors = await docterorsCollection.find({ status: 'approved' }).toArray();
for (let doc of doctors) {
  const todayAppointments = await AppointmentCollection.countDocuments({
    doctorId: doc._id,
    date: new Date().toISOString().split('T')[0],
    status: 'confirmed',
  });
  doc.nextSerial = todayAppointments + 1;
}
res.json(doctors);


    const serial = existingCount + 1;


    // Create new appointment
    const newAppointment = {
      doctorId,
      patientId: patientId || null,
      patientName,
      date: appointmentDate,
      time: time || doctor.available_time,
      reason: reason || "",
      status: "confirmed",
      serial,
      createdAt: new Date(),
    };

    const result = await AppointmentCollection.insertOne(newAppointment);

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointmentId: result.insertedId,
      serial: serial,
      doctor: {
        name: doctor.fullName,
        specialization: doctor.specialization,
        hospital: doctor.hospital,
        available_time: doctor.available_time,
      },
    });
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ message: "Internal server error" });
  }
 })

 // APPointmentlist list 
 app.get('/appointments-list', async (req, res) => {
   try {
    const appointments = await AppointmentCollection.find().sort({ createdAt: -1 ,serial:1 , date:1 }).toArray();

    if (appointments.length === 0) {
      return res.status(404).json({ message: "No appointments found" });
    }

    // collect doctors id and Patient id
     const doctorIds = [...new Set(appointments.map(a => a.doctorId))];
     const patientIds = [...new Set(appointments.map(a => a.patientId))];

     // Fetch doctors and patients details
   const doctors = await docterorsCollection
      .find({ _id: { $in: doctorIds.map(id => new ObjectId(id)) } })
      .project({ fullName: 1, specialization: 1, hospital: 1 })
      .toArray();
       const patients = await db
      .collection("users") // assuming your user collection is named 'users'
      .find({ _id: { $in: patientIds.map(id => new ObjectId(id)) } })
      .project({ name: 1, email: 1, phone: 1 })
      .toArray();

        // Merge doctor + patient info into appointment list
    const enrichedAppointments = appointments.map(a => {
      const doctor = doctors.find(d => d._id.toString() === a.doctorId);
      const patient = patients.find(p => p._id.toString() === a.patientId);

      return {
        _id: a._id,
        date: a.date,
        time: a.time,
        serial: a.serial,
        status: a.status,
        reason: a.reason || "",
        doctor: doctor
          ? {
              name: doctor.fullName,
              specialization: doctor.specialization,
              hospital: doctor.hospital,
            }
          : null,
        patient: patient
          ? {
              name: patient.name,
              email: patient.email,
              phone: patient.phone,
            }
          : null,
      };
    });
    res.status(200).json(enrichedAppointments);
   

   } catch (error) {
     console.error('Error fetching appointments:', error);
     res.status(500).json({ message: "Internal server error" });
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
