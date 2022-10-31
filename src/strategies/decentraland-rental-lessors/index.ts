import { getAddress } from '@ethersproject/address';
import { subgraphRequest } from '../../utils';
import { MarketplaceEstate, RentalsLandOrEstate, Scores } from './types';

export const author = 'fzavalia';
export const version = '0.1.0';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  const scores: Scores = {};

  // Initialize scores for every provided address as 0
  for (const address of addresses) {
    scores[getAddress(address)] = 0;
  }

  // For the provided addresses, fetch all their Lands and Estates that have been locked in the rentals contract.
  const rentalLandsAndEstates = await fetchLandsAndEstatesInRentalsContract(
    addresses,
    options,
    snapshot
  );

  const rentalLands: RentalsLandOrEstate[] = [];
  const rentalEstates: RentalsLandOrEstate[] = [];

  // Separate the assets into Lands and Estates
  for (const rentalLandOrEstate of rentalLandsAndEstates) {
    switch (rentalLandOrEstate.contractAddress) {
      case options.addresses.land.toLowerCase():
        rentalLands.push(rentalLandOrEstate);
        break;
      case options.addresses.estate.toLowerCase():
        rentalEstates.push(rentalLandOrEstate);
        break;
      default:
        console.log('Not a Land nor an Estate');
    }
  }

  // For each Land, increase the score of the original owner by the land multiplier.
  for (const land of rentalLands) {
    scores[getAddress(land.lessor)] += options.multipliers.land;
  }

  // Fill the estateSize prop on locked estates.
  const rentalAndMarketplaceEstates =
    await fetchMarketplaceEstatesForProvidedRentalAssets(
      rentalEstates,
      options,
      snapshot
    );

  // For each Estate, increase the score of the original owner by the size of the estate times the multiplier.
  for (const [rentalEstate, marketplaceEstate] of rentalAndMarketplaceEstates) {
    scores[getAddress(rentalEstate.lessor)] +=
      marketplaceEstate.size * options.multipliers.estateSize;
  }

  return scores;
}

// For a given list of addresses, fetch all the lands and estates that belonged to them before being transferred to the Rentals contract
async function fetchLandsAndEstatesInRentalsContract(
  addresses,
  options,
  snapshot
): Promise<RentalsLandOrEstate[]> {
  const query: any = {
    rentalAssets: {
      __args: {
        where: {
          contractAddress_in: [
            options.addresses.estate.toLowerCase(),
            options.addresses.land.toLowerCase()
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

  if (typeof snapshot === 'number') {
    query.rentalAssets.__args.block = { number: snapshot };
  }

  let acc: RentalsLandOrEstate[] = [];

  let hasNext = true;

  while (hasNext) {
    const result = await subgraphRequest(options.subgraphs.rentals, query);

    if (
      !result ||
      !result.rentalAssets ||
      !Array.isArray(result.rentalAssets)
    ) {
      break;
    }

    const rentalAssets: RentalsLandOrEstate[] = result.rentalAssets;

    if (rentalAssets.length < query.rentalAssets.__args.first) {
      hasNext = false;
    } else {
      query.rentalAssets.__args.skip += query.rentalAssets.__args.first;
    }

    acc = [...acc, ...rentalAssets];
  }

  return acc;
}

// For a given list of estates obtained from the rentals subgraph, fetch the estates that correspond to them in the marketplace subgraph.
async function fetchMarketplaceEstatesForProvidedRentalAssets(
  rentalEstates: RentalsLandOrEstate[],
  options,
  snapshot
): Promise<[RentalsLandOrEstate, MarketplaceEstate][]> {
  const lockedEstatesMap = new Map<string, RentalsLandOrEstate>();

  for (const lockedEstate of rentalEstates) {
    lockedEstatesMap.set(lockedEstate.tokenId, lockedEstate);
  }

  const query: any = {
    estates: {
      __args: {
        where: {
          tokenId_in: rentalEstates.map((estate) => estate.tokenId),
          size_gt: 0
        },
        first: 1000,
        skip: 0
      },
      tokenId: true,
      size: true
    }
  };

  if (typeof snapshot === 'number') {
    query.estates.__args.block = { number: snapshot };
  }

  const acc: [RentalsLandOrEstate, MarketplaceEstate][] = [];

  let hasNext = true;

  while (hasNext) {
    const result = await subgraphRequest(options.subgraphs.marketplace, query);

    const estates: MarketplaceEstate[] = result.estates;

    if (estates.length < query.estates.__args.first) {
      hasNext = false;
    } else {
      query.estates.__args.skip += query.estates.__args.first;
    }

    for (const estate of estates) {
      const lockedEstate = lockedEstatesMap.get(estate.tokenId);

      if (lockedEstate) {
        acc.push([lockedEstate, estate]);
      }
    }
  }

  return acc;
}
