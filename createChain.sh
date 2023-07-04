#!/bin/sh

DOCKER_BUILDKIT=0 docker build . -f testchains/Dockerfile_token_parity_no_seal -t poco-chaintest:5.3.0-token-parity --build-arg MNEMONIC="actual surround disorder swim upgrade devote digital misery truly verb slide final" --build-arg DEV_NODE=http://localhost:8545 