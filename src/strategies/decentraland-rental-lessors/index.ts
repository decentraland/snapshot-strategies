import { getAddress } from '@ethersproject/address';
import { subgraphRequest } from '../../utils';
import { AssetLockedInRentalsContract } from './types';

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
  const scores = {};

  // Initialize scores for every provided address as 0
  for (const address of addresses) {
    scores[getAddress(address)] = 0;
  }

  // For the provided addresses, fetch all their Lands and Estates that have been locked in the rentals contract.
  const lockedAssets = await fetchLandsAndEstatesLockedInRentalsContract(
    addresses,
    options,
    snapshot
  );

  const lockedLands: AssetLockedInRentalsContract[] = [];
  const lockedEstates: AssetLockedInRentalsContract[] = [];

  // Separate the assets into Lands and Estates
  for (const asset of lockedAssets) {
    switch (asset.contractAddress) {
      case options.addresses.land:
        lockedLands.push(asset);
        break;
      case options.addresses.estate:
        lockedEstates.push(asset);
    }
  }

  // For each Land, increase the score of the original owner by the land multiplier.
  for (const land of lockedLands) {
    scores[land.lessor] += options.multipliers.land;
  }

  await updateEstatesWithTheirSize(lockedEstates, options, snapshot);

  for (const estate of lockedEstates) {
    scores[estate.lessor] +=
      estate.estateSize! * options.multipliers.estateSize;
  }

  console.log(scores)

  return scores;
}

async function fetchLandsAndEstatesLockedInRentalsContract(
  addresses,
  options,
  snapshot
): Promise<AssetLockedInRentalsContract[]> {
  const query: any = {
    rentalAssets: {
      __args: {
        where: {
          contractAddress_in: [
            options.addresses.estate,
            options.addresses.land
          ],
          lessor_in: addresses,
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

  let accRentalAssets: AssetLockedInRentalsContract[] = [];

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

    const rentalAssets: AssetLockedInRentalsContract[] = result.rentalAssets;

    if (rentalAssets.length < query.rentalAssets.__args.first) {
      hasNext = false;
    }

    accRentalAssets = [...accRentalAssets, ...rentalAssets];
  }

  return accRentalAssets;
}

async function updateEstatesWithTheirSize(
  lockedEstates: AssetLockedInRentalsContract[],
  options,
  snapshot
): Promise<void> {
  const lockedEstatesMap = new Map<string, AssetLockedInRentalsContract>();

  for (const lockedEstate of lockedEstates) {
    lockedEstatesMap.set(lockedEstate.tokenId, lockedEstate);
  }

  const query: any = {
    estates: {
      __args: {
        where: {
          tokenId_in: lockedEstates.map((estate) => estate.tokenId),
          category: 'estate',
          searchEstateSize_gt: 0
        },
        first: 1000,
        skip: 0
      },
      owner: {
        id: true
      },
      searchEstateSize: true
    }
  };

  if (typeof snapshot === 'number') {
    query.estates.__args.block = { number: snapshot };
  }

  let hasNext = true;

  while (hasNext) {
    const result = await subgraphRequest(options.subgraphs.marketplace, query);

    if (!result || !result.estates || !Array.isArray(result.estates)) {
      break;
    }

    const estates: any[] = result.estates;

    if (estates.length < query.estates.__args.first) {
      hasNext = false;
    }

    for (const estate of estates) {
      const lockedEstate = lockedEstatesMap.get(estate.tokenId);

      if (lockedEstate) {
        lockedEstate.estateSize = estate.size;
      }
    }
  }
}
