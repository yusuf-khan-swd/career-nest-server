const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.DB_URL;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res
      .status(403)
      .send({ message: "Forbidden access! header is missing" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res
        .status(401)
        .send({ message: "Unauthorized access! Token is not valid" });
    }

    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    const usersCollection = client.db("thriftStore").collection("users");
    const categoriesCollection = client
      .db("thriftStore")
      .collection("categories");
    const productsCollection = client.db("thriftStore").collection("products");
    const ordersCollection = client.db("thriftStore").collection("orders");
    const paymentsCollection = client.db("thriftStore").collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const filter = { userEmail: decodedEmail };
      const user = await usersCollection.findOne(filter);

      if (user.userType !== "admin") {
        return res
          .status(401)
          .send({ message: "Unauthorized access. User is not admin" });
      }

      next();
    };

    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const filter = { userEmail: decodedEmail };
      const user = await usersCollection.findOne(filter);

      if (user.userType !== "seller") {
        return res
          .status(401)
          .send({ message: "Unauthorized access. User is not Seller" });
      }
      next();
    };

    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = user.userEmail;

      const filter = { userEmail: email };
      const isUserRegister = await usersCollection.findOne(filter);
      console.log(isUserRegister);

      if (!isUserRegister) {
        const result = await usersCollection.insertOne(user);
        return res.send({
          success: true,
          data: result,
        });
      } else {
        res.send({
          success: false,
          message: `${user.userName} you already have an account. Please login`,
        });
      }
    });

    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await usersCollection.findOne(query);
      res.send({ result });
    });

    app.put("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          userType: "admin",
        },
      };

      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.delete("/users", async (req, res) => {
      const email = req.query.email;

      const filter = { userEmail: email };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    app.get("/usersType", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.query.email;

      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ message: "Forbidden access! Email is not matched" });
      }

      const filter = { userEmail: decodedEmail };
      const result = await usersCollection.findOne(filter);
      res.send({ result });
    });

    app.post("/categories", verifyJWT, verifyAdmin, async (req, res) => {
      const category = req.body;
      const result = await categoriesCollection.insertOne(category);
      res.send(result);
    });

    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categoriesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;

      if (id === "all-products") {
        const query = { saleStatus: "available" };
        const result = await productsCollection.find(query).toArray();
        res.send(result);
      } else {
        const query = { categoryId: id, saleStatus: "available" };
        const result = await productsCollection.find(query).toArray();
        res.send(result);
      }
    });

    app.delete("/categories/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const categoryName = req.query.categoryName;
      const query = { productCategory: categoryName };
      await productsCollection.deleteMany(query);

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await categoriesCollection.deleteOne(filter);
      res.send(result);
    });

    app.post("/seller-product", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    app.get("/seller-products", verifyJWT, verifySeller, async (req, res) => {
      const email = req.query.email;
      const query = { sellerEmail: email };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    app.put(
      "/seller-product/:id",
      verifyJWT,
      verifySeller,
      async (req, res) => {
        const advertise = req.body.advertise;
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            advertised: !advertise,
          },
        };

        const result = await productsCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      }
    );

    app.delete(
      "/seller-product/:id",
      verifyJWT,
      verifySeller,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const result = await productsCollection.deleteOne(filter);
        res.send(result);
      }
    );

    app.get("/all-sellers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { userType: "seller" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/all-sellers/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const verified = req.body.verified;

      let isVerified = "";
      if (verified) {
        isVerified = true;
      } else {
        isVerified = false;
      }

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          userIsVerified: !isVerified,
        },
      };

      const email = req.query.email;
      const query = { sellerEmail: email };
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          sellerIsVerified: !isVerified,
        },
      };

      await productsCollection.updateMany(query, updateDoc, option);

      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.delete("/all-sellers/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/all-buyers", verifyJWT, verifyAdmin, async (req, res) => {
      const filter = { userType: "buyer" };
      const result = await usersCollection.find(filter).toArray();
      res.send(result);
    });

    app.delete("/all-buyers/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/all-admins", verifyJWT, verifyAdmin, async (req, res) => {
      const filter = { userType: "admin" };
      const result = await usersCollection.find(filter).toArray();
      res.send(result);
    });

    app.delete("/all-admins/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/advertised", async (req, res) => {
      const query = { advertised: true, saleStatus: "available" };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/orders", verifyJWT, async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    app.get("/orders", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { buyerEmail: decodedEmail };
      const result = await ordersCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.findOne(query);
      res.send(result);
    });

    app.delete("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/ordered-products", verifyJWT, verifySeller, async (req, res) => {
      const email = req.query.email;
      const filter = { sellerEmail: email };
      const result = await ordersCollection.find(filter).toArray();
      res.send(result);
    });

    app.put("/reported-products/:id", verifyJWT, async (req, res) => {
      const reported = req.body.reported;
      let isReported = "";
      if (reported) {
        isReported = true;
      } else {
        isReported = false;
      }

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          reported: !isReported,
        },
      };

      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.get("/reported-products", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { reported: true };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete(
      "/reported-products/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await productsCollection.deleteOne(query);
        res.send(result);
      }
    );

    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.productPrice;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const { orderId, productId } = payment;

      const filterOne = { _id: ObjectId(orderId) };
      const optionOne = { upsert: true };
      const updatedDocOne = {
        $set: {
          saleStatus: "paid",
        },
      };
      await ordersCollection.updateOne(filterOne, updatedDocOne, optionOne);

      const filterTwo = { _id: ObjectId(productId) };
      const optionTwo = { upsert: true };
      const updatedDocTwo = {
        $set: {
          saleStatus: "paid",
        },
      };
      await productsCollection.updateOne(filterTwo, updatedDocTwo, optionTwo);

      const result = await paymentsCollection.insertOne(payment);
      res.send(result);
    });
  } finally {
  }
}

run().catch(console.log);

app.get("/", (req, res) => {
  res.send("Thrift store server is running");
});

app.listen(port, () => {
  console.log(`Thrift store server is running on port ${port}`);
});
