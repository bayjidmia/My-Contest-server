const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
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
    const paymentCollection = db.collection("payments");
    const userCollection = db.collection("users");

    // user related API
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      const email = user.email;
      user.createdAt = new Date();
      const userExist = await userCollection.findOne({ email });
      if (userExist) {
        res.send({ massage: "user already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

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

    app.get("/all-contest", async (req, res) => {
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

    app.get("/contest/:id", async (req, res) => {
      const id = req.params.id;
      const querry = { _id: new ObjectId(id) };
      const result = await contestCollection.findOne(querry);
      res.send(result);
    });

    app.post("/create-contest", async (req, res) => {
      const contest = req.body;
      const cursor = await contestCollection.insertOne(contest);
      res.send(cursor);
    });
    app.patch("/contest-status/:id", async (req, res) => {
      const id = req.params.id;

      const updateDoc = {
        $set: {
          status: req.body.status, // "approved"
        },
      };

      const result = await contestCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );

      res.send(result);
    });
    app.patch("/contest-cancle/:id", async (req, res) => {
      const id = req.params.id;

      const updateDoc = {
        $set: {
          status: req.body.status, // "approved"
        },
      };

      const result = await contestCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );

      res.send(result);
    });
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      console.log("ttttttttttttt", paymentInfo);
      const deadline = String(paymentInfo.deadline);
      const amount = parseInt(paymentInfo.entryFee) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.contestName,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.userEmail,

        mode: "payment",
        metadata: {
          contestId: paymentInfo.contestId,
          contestName: paymentInfo.contestName,
          creatorEmail: paymentInfo.creatorEmail,
          deadline: deadline,
        },

        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancaled`,
      });

      console.log(session);
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log("ppppppppppppppppppppppppppppppp", session);
      const transactionId = session.payment_intent;
      const querry = { transactionId: transactionId };
      const existingpayment = await paymentCollection.findOne(querry);
      console.log("nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn", existingpayment);

      if (existingpayment) {
        return res.send({
          massage: "already axist",
          transactionId: transactionId,
        });
      }

      if (session.payment_status === "paid") {
        const id = session.metadata.contestId;
        const querry = { _id: new ObjectId(id) };
        const update = {
          $set: {
            paymentStatus: "paid",
          },
        };

        const result = await contestCollection.updateOne(querry, update);
        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          creatorEmail: session.metadata.creatorEmail,
          userEmmail: session.customer_email,
          contestd: session.metadata.contestId,
          contestName: session.metadata.contestName,
          transactionId: session.payment_intent,
          paymentstatus: session.payment_status,
          deadline: session.metadata.deadline,
        };

        if (session.payment_status === "paid") {
          const resultPayment = await paymentCollection.insertOne(payment);
          return res.send({
            sucess: true,
            modificontest: result,
            paymentInfo: resultPayment,
            transactionId: transactionId,
          });
        }
      }

      return res.send({ success: false });
    });
    app.post("/contest/:id/submission", async (req, res) => {
      const contestId = req.params.id;
      const submission = req.body;

      const contest = await contestCollection.findOne({
        _id: new ObjectId(contestId),
        "submissions.userEmail": submission.userEmail,
      });

      if (contest) {
        return res.send({ message: "Already submitted" });
      }
      const result = await contestCollection.updateOne(
        { _id: new ObjectId(contestId) },
        {
          $push: {
            submissions: {
              userName: submission.userName,
              userEmail: submission.userEmail,
              userPhoto: submission.userPhoto,
              submissionLink: submission.submissionLink,
              submittedAt: new Date(),
            },
          },
        }
      );

      res.send(result);
    });
    app.get("/my-contest", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({ message: "email required" });
      }

      // user যেসব contest এ payment করেছে
      const payments = await paymentCollection
        .find({ userEmmail: email })
        .sort({ deadline: 1 })
        .toArray();
      res.send(payments);
    });

    app.get("/all-user", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch("/status-change/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role) {
          return res
            .status(400)
            .json({ success: false, message: "Role is required" });
        }

        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );

        if (result.modifiedCount > 0) {
          res.json({ success: true, modifiedCount: result.modifiedCount });
        } else {
          res
            .status(404)
            .json({ success: false, message: "No document updated" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.patch("/status-change/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role) {
          return res
            .status(400)
            .json({ success: false, message: "Role is required" });
        }

        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );

        if (result.modifiedCount > 0) {
          res.json({ success: true, modifiedCount: result.modifiedCount });
        } else {
          res
            .status(404)
            .json({ success: false, message: "No document updated" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.patch("/role-change/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

      console.log(role, id);

      if (!role) {
        return res
          .status(400)
          .json({ success: false, message: "Role is required" });
      }

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );
      res.send(result);
    });

    app.patch("/role-change/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

      console.log(role, id);

      if (!role) {
        return res
          .status(400)
          .json({ success: false, message: "Role is required" });
      }

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );
      res.send(result);
    });

    app.get("/set-winner/:email", async (req, res) => {
      const email = req.params.email;

      try {
        const result = await contestCollection
          .find({ creatorEmail: email }) // বা winnerEmail: email
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to get winner contests" });
      }
    });

    app.patch("/declare-winner", async (req, res) => {
      try {
        const { contestId, winner } = req.body;
        console.log(contestId, winner);

        if (!contestId || !winner?.email) {
          return res.status(400).send({
            message: "Invalid request data",
          });
        }

        const query = { _id: new ObjectId(contestId) };

        // contest খুঁজে বের করো
        const contest = await contestCollection.findOne(query);
        console.log(contest);

        if (!contest) {
          return res.status(404).send({
            message: "Contest not found",
          });
        }

        // 🔒 Already winner থাকলে আর update হবে না
        if (contest.winner && contest.winner.email) {
          return res.status(400).send({
            message: "Winner already declared",
          });
        }

        // ✅ Winner set করো
        const updateDoc = {
          $set: {
            winner: {
              name: winner.name,
              email: winner.email,
              photo: winner.photo,
              declaredAt: new Date(),
            },
          },
        };

        const result = await contestCollection.updateOne(query, updateDoc);
        console.log(result);
        console.log("ssssssssssssssssssssssssssss", result.modifiedCount);

        res.send({
          success: true,
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({
          message: "Internal server error",
        });
      }
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
