const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("ATS Backend");
});

app.get("/api/jobs", (req, res) => {
  try {
    const jobs = [
      { id: 1, title: "Software Engineer", description: "Develop software" },
      { id: 2, title: "Product Manager", description: "Manage products" },
    ];
    res.json(jobs);
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ message: "Error fetching jobs" });
  }
});

const PORT = process.env.port || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
