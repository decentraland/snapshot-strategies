import { getAddress } from '@ethersproject/address';
import { subgraphRequest } from '../../utils';
import { Config, RentalAsset, Scores } from './types';

export const author = 'fzavalia';
export const version = '0.1.0';

const ConfigByNetwork: { [network: string]: Config } = {
  '1': {
    estateContractAddress: '0x124bf28a423b2ca80b3846c3aa0eb944fe7ebb95',
    landContractAddress: '0xc9a46712e6913c24d15b46ff12221a79c4e251dc',
    rentalsSubgraphUrl:
      'https://api.thegraph.com/subgraphs/name/decentraland/rentals-ethereum-mainnet',
    landMultiplier: 2000,
    estateLandMultiplier: 2000
  },
  '5': {
    estateContractAddress: '0x124bf28a423b2ca80b3846c3aa0eb944fe7ebb95',
    landContractAddress: '0x25b6b4bac4adb582a0abd475439da6730777fbf7',
    rentalsSubgraphUrl:
      'https://api.thegraph.com/subgraphs/name/decentraland/rentals-ethereum-goerli',
    landMultiplier: 2000,
    estateLandMultiplier: 2000
  }
};

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  const sanitizedAddresses = (addresses as string[]).map((address: string) =>
    getAddress(address)
  );

  const scores: Scores = {};

  for (const address of sanitizedAddresses) {
    scores[address] = 0;
  }

  const config = ConfigByNetwork[network];

  if (!config) {
    return scores;
  }

  const rentalAssets = await fetchRentalAssetsFromRentalsSubgraph(
    sanitizedAddresses,
    config
  );

  const lands: RentalAsset[] = [];
  const estates: RentalAsset[] = [];

  for (const rentalAsset of rentalAssets) {
    switch (rentalAsset.contractAddress) {
      case config.estateContractAddress:
        estates.push(rentalAsset);
        break;
      case config.landContractAddress:
        lands.push(rentalAsset);
        break;
      default:
    }
  }

  for (const land of lands) {
    scores[getAddress(land.lessor)] += config.landMultiplier;
  }

  // for (const rentalAsset in rentalAssets) {
  //   if (rentalAsset.contractAddress) {
  //   }
  // }

  // // if graph doesn't exists return automaticaly
  // if (!DECENTRALAND_RENTALS_SUBGRAPH_URL[network]) {
  //   return scores;
  // }

  // // initialize multiplers and params
  // const multiplers = options.multipliers || {};

  // const params = {
  //   nfts: {
  //     __args: {
  //       where: {
  //         itemType_in: [
  //           'wearable_v1',
  //           'wearable_v2',
  //           'smart_wearable_v1',
  //           'emote_v1'
  //         ],
  //         owner_in: addresses.map((address) => address.toLowerCase()),
  //         id_gt: ''
  //       },
  //       orderBy: 'id',
  //       orderDirection: 'asc',
  //       first: 1000
  //     },
  //     id: true,
  //     owner: {
  //       id: true
  //     },
  //     searchWearableRarity: true
  //   }
  // };

  // if (options.collections) {
  //   // @ts-ignore
  //   params.nfts.__args.where.collection_in = options.collections;
  // }

  // if (snapshot !== 'latest') {
  //   // @ts-ignore
  //   params.nfts.__args.block = { number: snapshot };
  // }

  // // load and add each wearable by rarity
  // let hasNext = true;
  // while (hasNext) {
  //   const result = await subgraphRequest(
  //     DECENTRALAND_RENTALS_SUBGRAPH_URL[network],
  //     params
  //   );

  //   const nfts = result && result.nfts ? result.nfts : [];
  //   const latest = nfts[nfts.length - 1];
  //   for (const wearable of nfts) {
  //     const userAddress = getAddress(wearable.owner.id);
  //     const rarity = String(wearable.searchWearableRarity).toLowerCase().trim();
  //     scores[userAddress] =
  //       (scores[userAddress] ?? 0) + (multiplers[rarity] ?? 0);
  //   }

  //   hasNext = nfts.length === params.nfts.__args.first;
  //   if (hasNext) {
  //     params.nfts.__args.where.id_gt = latest?.id || '';
  //   }
  // }

  return scores;
}

async function fetchRentalAssetsFromRentalsSubgraph(
  addresses: string[],
  config: Config
): Promise<RentalAsset[]> {
  const query = {
    rentalAssets: {
      __args: {
        where: {
          contractAddress_in: [
            config.estateContractAddress,
            config.landContractAddress
          ],
          lessor_in: addresses.map((address) => address.toLowerCase()),
          isClaimed: false
        },
        first: 1000,
        skip: 0
      },
      id: true,
      contractAddress: true,
      tokenId: true,
      lessor: true
    }
  };

  let accRentalAssets: RentalAsset[] = [];

  let hasNext = true;

  while (hasNext) {
    const result = await subgraphRequest(config.rentalsSubgraphUrl, query);

    if (
      !result ||
      !result.rentalAssets ||
      !Array.isArray(result.rentalAssets)
    ) {
      break;
    }

    const rentalAssets: RentalAsset[] = result.rentalAssets;

    if (rentalAssets.length < query.rentalAssets.__args.first) {
      hasNext = false;
    }

    accRentalAssets = [...accRentalAssets, ...rentalAssets];
  }

  return accRentalAssets;
}

async function fetchEstatesAssetsFromMarketplaceSubgraph(
  addresses: string[],
  config: Config
): Promise<RentalAsset[]> {
  const query = {
    rentalAssets: {
      __args: {
        where: {
          contractAddress_in: [
            config.estateContractAddress,
            config.landContractAddress
          ],
          lessor_in: addresses.map((address) => address.toLowerCase()),
          isClaimed: false
        },
        first: 1000,
        skip: 0
      },
      id: true,
      contractAddress: true,
      tokenId: true,
      lessor: true
    }
  };

  let accRentalAssets: RentalAsset[] = [];

  let hasNext = true;

  while (hasNext) {
    const result = await subgraphRequest(config.rentalsSubgraphUrl, query);

    if (
      !result ||
      !result.rentalAssets ||
      !Array.isArray(result.rentalAssets)
    ) {
      break;
    }

    const rentalAssets: RentalAsset[] = result.rentalAssets;

    if (rentalAssets.length < query.rentalAssets.__args.first) {
      hasNext = false;
    }

    accRentalAssets = [...accRentalAssets, ...rentalAssets];
  }

  return accRentalAssets;
}
