const Sentiment = require('sentiment');
const nlp = require('compromise');
const sentiment = new Sentiment();

function getSentiment(text) {
  const result = sentiment.analyze(text);
  console.log("Sentiment Analysis Result:", result);
  return result.comparative || 0;
}

function extractKeywords(text) {
  const doc = nlp(text);
  return doc.nouns().out('array').slice(0, 20);
}

module.exports = { getSentiment, extractKeywords };