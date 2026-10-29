import { describeArtworkRepositoryContract } from "./artwork-repository.contract";
import { FakeArtworkRepository } from "./fake-artwork-repository";

describeArtworkRepositoryContract("FakeArtworkRepository", async () => new FakeArtworkRepository());
