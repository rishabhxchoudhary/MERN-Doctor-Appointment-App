const express = require('express');
require('dotenv').config();
const dbconfig = require('./config/dbconfig');
const userRoutes = require('./routes/userRoute');
const adminRoute = require("./routes/adminRoute");
const doctorRoute = require("./routes/doctorRoute");

const app = express();

app.use(express.json());
app.use('/api/user', userRoutes);
app.use("/api/admin", adminRoute);
app.use("/api/doctor", doctorRoute);


const port = 5001;

app.listen(port, () => console.log(`Server running on port ${port}`));

app.get("/", (req, res) => {
    res.send("Hello World");
});