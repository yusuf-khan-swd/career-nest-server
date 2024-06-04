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
    const jobsCollection = careerNestDB.collection("jobs");

    // ---------------------------- Users Routes --------------------

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

    // ---------------------------- Jobs Routes --------------------

    app.post("/jobs", verifyJWT, async (req, res) => {
      const jobs = req.body;
      const result = await jobsCollection.insertOne(jobs);
      res.send(result);
    });

    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find({}).toArray();
      res.send(result);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };

      const result = await jobsCollection.findOne(filter);
      res.send(result);
    });

    app.patch("/jobs/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const jobsData = req.body;

      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: jobsData,
      };

      const result = await jobsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.delete("/jobs/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await jobsCollection.deleteOne(filter);
      res.send(result);
    });

    // ---------------------------- categories Routes --------------------

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
        const result = await jobsCollection.find(query).toArray();
        res.send(result);
      } else {
        const query = { categoryId: id, saleStatus: "available" };
        const result = await jobsCollection.find(query).toArray();
        res.send(result);
      }
    });

    app.delete("/categories/:id", verifyJWT, async (req, res) => {
      const categoryName = req.query.categoryName;
      const query = { productCategory: categoryName };
      await jobsCollection.deleteMany(query);

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await categoriesCollection.deleteOne(filter);
      res.send(result);
    });
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
