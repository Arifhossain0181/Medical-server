const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
app.use(cors());
app.use(express.json());

const { ObjectId } = require("mongodb");

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.USER_BD}:${process.env.PASS_BD}@co.sb0kq7l.mongodb.net/?retryWrites=true&w=majority&appName=Co`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const doctorscollection = client.db("Madical").collection("doctors");
    const servicscollection = client.db("Madical").collection("service");
    const mycarcollection = client.db("Madical").collection("mycart");



    //doctors
    app.get("/doctors", async (req, res) => {
      const doctors = await doctorscollection.find().toArray();
      res.send(doctors);
    });
    app.get("/doctors/:id", async (req, res) => {
      const id = Number(req.params.id); // Convert id to number
      const result = await doctorscollection.findOne({ id: id }); // Find by id field
      res.send(result);
    });
    //service data 
    app.get('/service',async (req,res) =>{
      const servicesdoctors = await servicscollection.find().toArray();
      res.send(servicesdoctors)
    })


    //my cart my aPPlication here 
app.get('/mycart',async (req,res) =>{
  const result = await mycarcollection.find().toArray()
  res.send(result)
})
app.get('/mycart/user' ,async (req,res) =>{
  const email  =  req.query.userEmail;
  const query ={email: email}
  const result = await mycarcollection.find(query).toArray()
  res.send(result)
  
})
    app.post('/mycart',async(req,res)=>{
      const mycart = req.body;
      const result = await mycarcollection.insertOne(mycart);
      res.send(result)
    })

//delet oPeration here 
app.delete('/mycart/:id' ,async (req,res) =>{
  const id = req.params.id;
  const query =  {_id: new ObjectId(id)}
  const result = await mycarcollection.deleteOne(query)
  res.send(result)
})

//UPdate OPeration 

app.get('/mycart/:id' ,async (req,res) =>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await mycarcollection.findOne(query)
  res.send(result);
  

})
app.patch('/mycart/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateData = req.body;

  const updateDoc = {
    $set: {
      service: updateData.service,
      date: updateData.date,
      time: updateData.time,
      name: updateData.name,
      phone: updateData.phone,
      email: updateData.email,
    }
  };

  const result = await mycarcollection.updateOne(filter, updateDoc);
  res.send(result);
});




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //  await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Madical");
});
app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
