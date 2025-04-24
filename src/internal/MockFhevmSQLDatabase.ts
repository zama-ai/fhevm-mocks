import assert from "assert";
import { Database } from "sqlite3";

import { HardhatFhevmError } from "../error";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { assertFhevm } from "./error";

export class MockFhevmSQLDatabase {
  //Keep it for consistency
  //eslint-disable-next-line no-unused-private-class-members
  #fhevmEnv: FhevmEnvironment;
  #initializing: boolean = false;
  #initialized: boolean = false;
  #sqlDatabase: Database | undefined;
  #countHandles: number = 0;

  /**
   * Constructor must be ultra-lightweight!
   */
  constructor(fhevmEnv: FhevmEnvironment) {
    this.#fhevmEnv = fhevmEnv;
  }

  public get countHandles(): number {
    return this.#countHandles;
  }

  private async get(): Promise<Database> {
    if (this.#sqlDatabase === undefined) {
      await this._create();
      // For typescript
      assert(this.#sqlDatabase !== undefined, "Internal sql db has not been created");
    }
    return this.#sqlDatabase;
  }

  private async _create(): Promise<Database> {
    if (this.#initialized) {
      throw new HardhatFhevmError("Mock Fhevm Database already initialized.");
    }
    if (this.#initializing) {
      throw new HardhatFhevmError("Mock Fhevm Database not yet initialized.");
    }
    this.#initializing = true;

    //const db = new Database('./sql.db');
    const db = new Database(":memory:");

    const p = new Promise<Database>((resolve, reject) => {
      db.serialize(() =>
        db.run(
          "CREATE TABLE IF NOT EXISTS ciphertexts (handle BINARY PRIMARY KEY,clearText TEXT)",
          (err: Error | null) => {
            if (err) {
              reject(new HardhatFhevmError("Mock Fhevm Database creation failed.", err));
            } else {
              assert(this instanceof MockFhevmSQLDatabase);
              assert(this.#initializing === true);
              assert(this.#initialized === false);
              this.#initializing = false;
              this.#initialized = true;
              this.#sqlDatabase = db;
              resolve(db);
            }
          },
        ),
      );
    });

    return await p;
  }

  public async sqlInsertHandleBytes32(
    handleBytes32Hex: string,
    clearText: bigint | string,
    replace: boolean = false,
  ): Promise<void> {
    assertFhevm(handleBytes32Hex.startsWith("0x"), "Invalid handleBytes32Hex argument");

    // For debug purpose
    const theThis: { t: MockFhevmSQLDatabase } = { t: this };
    const db = await this.get();

    const clearTextStr = typeof clearText !== "string" ? clearText.toString() : clearText;

    // this is useful if using snapshots while sampling different random numbers on each revert
    const sql = replace
      ? "INSERT OR REPLACE INTO ciphertexts (handle, clearText) VALUES (?, ?)"
      : "INSERT OR IGNORE INTO ciphertexts (handle, clearText) VALUES (?, ?)";

    return new Promise((resolve, reject) => {
      db.run(sql, [handleBytes32Hex, clearTextStr], (err: Error | null) => {
        if (err) {
          reject(
            new HardhatFhevmError(
              `Error inserting handle=${handleBytes32Hex} clearText=${clearTextStr} in database`,
              err,
            ),
          );
        } else {
          // Debug: Make sure the 'this' context keyword is properly computed.
          assert(this instanceof MockFhevmSQLDatabase);
          assert(this === theThis.t);
          theThis.t.#countHandles++;
          resolve();
        }
      });
    });
  }

  public async sqlQueryHandleBytes32AsBigInt(handleBytes32Hex: string): Promise<bigint> {
    const str: string = await this.sqlQueryHandleBytes32(handleBytes32Hex);
    return BigInt(str);
  }

  public async sqlQueryHandleBytes32(handleBytes32Hex: string): Promise<string> {
    assertFhevm(handleBytes32Hex.startsWith("0x"), "Invalid handleBytes32Hex argument");

    const db = await this.get();

    return new Promise((resolve, reject) => {
      const MAX_SQL_RETRIES = 100;

      let attempts = 0;

      function __executeSQLSelect() {
        db.get(
          "SELECT clearText FROM ciphertexts WHERE handle = ?",
          [handleBytes32Hex],
          (err, row: { clearText: string }) => {
            if (err) {
              reject(new HardhatFhevmError(`Error querying database: ${err.message}`));
            } else if (row) {
              assert(typeof row.clearText === "string");
              resolve(row.clearText);
            } else if (attempts < MAX_SQL_RETRIES) {
              attempts++;
              // TODO get rid of recursive call ???
              __executeSQLSelect();
            } else {
              reject(new HardhatFhevmError("No record found after maximum retries"));
            }
          },
        );
      }

      __executeSQLSelect();
    });
  }
}
