import Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic client, shared by every feature that calls a model.
 *
 * Built on first use rather than at import time. Module-level construction
 * would read the API key before `dotenv.config()` has necessarily run --
 * services are imported before server.ts reaches its own dotenv call, so the
 * key is only loaded today because db_connect.ts happens to configure dotenv
 * and happens to be imported first. Deferring removes that dependency.
 */

let client: Anthropic | null = null;

/** The model every insight runs on. Kept here so it changes in one place. */
export const INSIGHT_MODEL = "claude-haiku-5-5";

/**
 * Whether the model can be called at all. Callers check this to degrade
 * gracefully -- an insight is an enhancement, so a missing key should cost
 * you the explanation, not the endpoint.
 */
export const isLlmConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

export const getLlmClient = () => {
    if (!isLlmConfigured())
        throw new Error("ANTHROPIC_API_KEY is not set");

    // The SDK reads ANTHROPIC_API_KEY from the environment itself; passing it
    // explicitly would just be a second place to keep in sync.
    if (!client)
        client = new Anthropic();

    return client;
};
