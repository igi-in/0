# ======== redis-cli
1. Install Dependency (di Codespaces)
bash
sudo apt update
sudo apt install build-essential tcl -

2. Download dan Build redis-cli Saja
bash
cd /app
mkdir -p local/bin
curl -O https://download.redis.io/redis-stable.tar.gz
tar xzvf redis-stable.tar.gz
cd redis-stable

## Build hanya redis-cli
make redis-cli

3. Copy ke Folder Lokal
bash
cp src/redis-cli ../local/bin/

4. Tes Binary
bash
/app/local/bin/redis-cli --version
file /app/local/bin/redis-cli

## Output harus mengandung: ELF 64-bit LSB executable, ARM aarch64 if aarch arm64 in your system



5. Tes Koneksi ke Redis Server
bash
/app/local/bin/redis-cli -h redis.redis -p 6379 ping
/app/local/bin/redis-cli -h redis.redis -p 6379
/app/local/bin/redis-cli -h redis.redis -p 6379 info memory
/app/local/bin/redis-cli -h redis.redis -p 6379 info stats

# ========pgcli - postgres
1. sudo apt-get install pgcli
pgcli postgres://postgres:postgres@postgres.postgres:5432/app


# ======== Log Style
## install
sudo apt-get install ccze
## Realtime Update
tail -f s.log | ccze -A
## Realtime Full Logs File
cat s.log | ccze -A && tail -f s.log | ccze -A

