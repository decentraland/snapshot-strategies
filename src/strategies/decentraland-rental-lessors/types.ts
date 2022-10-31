export type Config = {
  estateContractAddress: string;
  landContractAddress: string;
  rentalsSubgraphUrl: string;
  landMultiplier: number;
  estateLandMultiplier: number;
};

export type Scores = {
  [address: string]: number;
};

export type RentalAsset = {
  id: string;
  contractAddress: string;
  tokenId: string;
  lessor: string;
};
