require('dotenv').config()


const audience = process.env.AUTH0_AUDIENCE;
const domain = process.env.AUTH0_DOMAIN;
const serverPort = process.env.PORT || 4000;

console.log(process.env);

if (!audience) {
    throw new Error(
        '.env is missing the definition of an AUTH0_AUDIENCE environmental variable'
    );
}

if (!domain) {
    throw new Error(
        '.env is missing the definition of an AUTH0_DOMAIN environmental variable'
    );
}

const clientOrigins = ['http://localhost:4040', 'http://localhost:3000'];

module.exports = {
    audience,
    domain,
    serverPort,
    clientOrigins,
};
