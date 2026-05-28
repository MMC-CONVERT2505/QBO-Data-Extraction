import axios from "axios";
import config from "../config/qbo.config.js";

const qboClient = (accessToken, realmId) => {
  return axios.create({
    baseURL: `${config.baseUrl}/v3/company/${realmId}`,

    headers: {
      Authorization: `Bearer ${accessToken}`,

      Accept: "application/json",

      "Content-Type": "application/json",
    },
  });
};

const qboQuery = async (
  accessToken,
  realmId,
  query
) => {
  const client = qboClient(
    accessToken,
    realmId
  );

  const response = await client.get(
    "/query",
    {
      params: {
        query,
        minorversion: 75,
      },
    }
  );

  return response.data.QueryResponse;
};

export {
  qboClient,
  qboQuery,
};