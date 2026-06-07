import { matchPath } from 'react-router-dom';
const match = matchPath(
  "/frontend/graph/:uri",
  "/frontend/graph/https%3A%2F%2Fplus.cobiss.net%2Fcobiss%2Fsi%2Fsl%2Fsgc%2F547176"
);
console.log(match);
