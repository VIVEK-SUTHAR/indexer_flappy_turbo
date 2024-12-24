Update RPC in Mainnet,
update programid in Mainnet
Flush redis cache in Mainnet before index

docker build -t indexer-sol .
docker run -p 6379:6379 -p 3000:3000 indexer-sol
