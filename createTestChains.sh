#!/bin/sh

DOCKER_BUILDKIT=0 docker build . -f testchains/Dockerfile_token_ganache -t poco-chaintest:5.3.0-ganache-update-token --build-arg MNEMONIC="actual surround disorder swim upgrade devote digital misery truly verb slide final" &&
DOCKER_BUILDKIT=0 docker build . -f testchains/Dockerfile_token_ganache_1s -t poco-chaintest:5.3.0-ganache-update-token-1s &&
DOCKER_BUILDKIT=0 docker build . -f testchains/Dockerfile_native_ganache -t poco-chaintest:5.3.0-ganache-update-native --build-arg MNEMONIC="actual surround disorder swim upgrade devote digital misery truly verb slide final" &&
DOCKER_BUILDKIT=0 docker build . -f testchains/Dockerfile_token_parity_no_seal -t poco-chaintest:5.3.0-token-parity --build-arg MNEMONIC="actual surround disorder swim upgrade devote digital misery truly verb slide final" --build-arg DEV_NODE=http://localhost:8545 &&
DOCKER_BUILDKIT=0 docker build . -f testchains/Dockerfile_native_parity_no_seal -t poco-chaintest:5.3.0-native-parity --build-arg MNEMONIC="actual surround disorder swim upgrade devote digital misery truly verb slide final" --build-arg DEV_NODE=http://localhost:8545
