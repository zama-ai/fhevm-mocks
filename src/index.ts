import { extendConfig, extendEnvironment, extendProvider } from "hardhat/config";

/**
 * HH Plugin Config
 */
import { configExtender } from "./internal/ConfigExtender";
import { envExtender } from "./internal/EnvironmentExtender";
import { providerExtender } from "./internal/ProviderExtender";
import "./tasks/builtin-tasks";
/**
 * Tasks
 */
import "./tasks/fhevm";
import "./type-extentions";

extendConfig(configExtender);

extendEnvironment(envExtender);

extendProvider(providerExtender);

export * from "./types";
