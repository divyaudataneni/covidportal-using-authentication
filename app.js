const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error '${e.message}'`);
    process.exit(1);
  }
};
initializeDBAndServer();
module.exports = app;

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_Secret_Token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const loginQuery = ` SELECT * FROM user WHERE username = '${username}';`;

  const dbUser = await db.get(loginQuery);

  if (dbUser === undefined) {
    //invalid user
    response.status(400);
    response.send("Invalid user");
  } else {
    //Valid password
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched !== true) {
      //Invalid user
      response.status(400);
      response.send("Invalid password");
    } else {
      //valid user
      const payload = { username: username };
      jwtToken = jwt.sign(payload, "My_Secret_Token");
      response.send({ jwtToken });
    }
  }
});

//API 2

app.get("/states/", authenticateToken, async (request, response) => {
  const stateQuery = `
    SELECT * FROM state;`;
  const dbResponse = await db.all(stateQuery);
  response.send(
    dbResponse.map((each) => convertStateDbObjectToResponseObject(each))
  );
});

//API 3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const getStateQuery = `
        SELECT * FROM state WHERE state_id = '${stateId}'`;
  const dbRes = await db.get(getStateQuery);
  response.send(convertStateDbObjectToResponseObject(dbRes));
});

//API4

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const postQuery = `
    INSERT INTO  district (district_name,state_id,cases,cured,active,deaths)
    VALUES ( '${districtName}','${stateId}',
     '${cases}',
      '${cured}',
      '${active}',
     '${deaths}');
    `;
  const dbres = await db.run(postQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getQuery = `
    SELECT * FROM district WHERE district_id = '${districtId}'`;
    const dbResponse = await db.get(getQuery);
    response.send(convertDistrictDbObjectToResponseObject(dbResponse));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getQuery = `
    DELETE  FROM district WHERE district_id = '${districtId}'`;
    const dbResponse = await db.run(getQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;

    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateQuery = `
    UPDATE district
    SET district_name = '${districtName}',
         state_id = ${stateId},
         cases = ${cases},
         cured = ${cured},
         active = ${active},
         deaths = ${deaths} 
    WHERE district_id = ${districtId};`;
    const updatedDistrict = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `
  SELECT 
     SUM(cases),
     SUM(cured),
     SUM(active),
     SUM(deaths)
  FROM district
  WHERE state_id = ${stateId};
  `;
    const stats = await db.get(getStateQuery);
    console.log(stats);

    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
