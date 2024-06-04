const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// git deployment is not working properly with vercel

const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.DB_URL;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const jwt_secret = process.env.JWT_SECRET;

const createToken = (user) => {
  return jwt.sign(
    {
      email: user?.email,
    },
    jwt_secret,
    { expiresIn: "7d" }
  );
};

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res
      .status(403)
      .send({ message: "Forbidden access! header is missing" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, jwt_secret, function (err, decoded) {
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
    const careerNestDB = client.db("careerNest");

    const usersCollection = careerNestDB.collection("users");
    const categoriesCollection = careerNestDB.collection("categories");
    const productsCollection = careerNestDB.collection("products");
    const ordersCollection = careerNestDB.collection("orders");

    // Users Routes
    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = user?.email;
      const token = createToken(user);

      const isUserExist = await usersCollection.findOne({ email });
      console.log({ isUserExist });

      if (!isUserExist) {
        const result = await usersCollection.insertOne(user);
        return res.send({
          success: true,
          message: "Successfully login",
          data: { ...result, token },
        });
      } else {
        res.send({
          success: false,
          message: `You already have an account. Successfully login`,
          data: { token },
        });
      }
    });

    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const result = await usersCollection.findOne({ email });
      res.send({
        success: true,
        message: "Successfully get user data",
        data: result,
      });
    });

    app.get("/user/profile/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch("/user/profile/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: data },
        { upsert: true }
      );

      res.send(result);
    });

    app.delete("/users", async (req, res) => {
      const email = req.query.email;

      const filter = { userEmail: email };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.post("/categories", verifyJWT, async (req, res) => {
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

    app.delete("/categories/:id", verifyJWT, async (req, res) => {
      const categoryName = req.query.categoryName;
      const query = { productCategory: categoryName };
      await productsCollection.deleteMany(query);

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await categoriesCollection.deleteOne(filter);
      res.send(result);
    });

    app.post("/seller-product", verifyJWT, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    app.get("/seller-products", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { sellerEmail: email };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    app.put(
      "/seller-product/:id",
      verifyJWT,

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

      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const result = await productsCollection.deleteOne(filter);
        res.send(result);
      }
    );

    app.get("/all-sellers", verifyJWT, async (req, res) => {
      const query = { userType: "seller" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/all-sellers/:id", verifyJWT, async (req, res) => {
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

    app.delete("/all-sellers/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/all-buyers", verifyJWT, async (req, res) => {
      const filter = { userType: "buyer" };
      const result = await usersCollection.find(filter).toArray();
      res.send(result);
    });

    app.delete("/all-buyers/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/all-admins", verifyJWT, async (req, res) => {
      const filter = { userType: "admin" };
      const result = await usersCollection.find(filter).toArray();
      res.send(result);
    });

    app.delete("/all-admins/:id", verifyJWT, async (req, res) => {
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

    app.get("/ordered-products", verifyJWT, async (req, res) => {
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

    app.get("/reported-products", verifyJWT, async (req, res) => {
      const query = { reported: true };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete(
      "/reported-products/:id",
      verifyJWT,

      async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await productsCollection.deleteOne(query);
        res.send(result);
      }
    );
  } finally {
  }
}

run().catch(console.log);

app.get("/", (req, res) => {
  res.send("Career Nest server is running");
});

app.listen(port, () => {
  console.log(`Career Nest server is running on port ${port}`);
});
