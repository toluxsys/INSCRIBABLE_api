#! /usr/bin/bash
echo "INSCRIBING..."
ord index
read -p "Press any key to continue..."
ord --wallet ordinalHashes wallet inscribe "/home/ubuntu/Downloads/hashes/80.png" --fee-rate 6
sleep 3
ord --wallet ordinalHashes wallet inscribe "/home/ubuntu/Downloads/hashes/81.png" --fee-rate 6
sleep 3
ord --wallet ordinalHashes wallet inscribe "/home/ubuntu/Downloads/hashes/82.png" --fee-rate 6
read -p "Press any key to end..."