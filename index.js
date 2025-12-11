const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// midleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xyk22ac.mongodb.net/?appName=Cluster0`;
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
    const db = client.db("my_contest_db");
    const contestCollection = db.collection("contest");

    app.get("/latest-contest", async (req, res) => {
      const cursor = contestCollection.find().sort({ _id: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/dashboard/contest-aprove", async (req, res) => {
      const cursor = contestCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/all-content", async (req, res) => {
      const status = req.query.status; // user diye dibe ?status=pending

      let filter = {};

      if (status) {
        filter.status = status;
      }

      const contests = await contestCollection.find(filter).toArray();

      res.send(contests);
    });

    app.get("/contest-details/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    app.post("/create-contest", async (req, res) => {
      const contest = req.body;
      const cursor = await contestCollection.insertOne(contest);
      res.send(cursor);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
