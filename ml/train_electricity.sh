#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/Informer2020"
MPLCONFIGDIR=/private/tmp/mplconfig ../.venv/bin/python main_informer.py \
  --model informer --data custom \
  --root_path ../../data/processed/electricity --data_path ecl_10_hourly.csv \
  --features M --target MT_011 --freq h \
  --enc_in 10 --dec_in 10 --c_out 10 \
  --seq_len 48 --label_len 24 --pred_len 3 \
  --d_model 64 --n_heads 4 --d_ff 128 --e_layers 2 --d_layers 1 \
  --batch_size 64 --train_epochs 2 --patience 2 --itr 1 \
  --checkpoints ../../artifacts/informer --des ecl10_hourly_3h
