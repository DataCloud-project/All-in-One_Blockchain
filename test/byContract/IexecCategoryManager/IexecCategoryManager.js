/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

// Config
var DEPLOYMENT         = require("../../../config/config.json").chains.default;
// Artefacts
var RLC                = artifacts.require("rlc-faucet-contract/contracts/RLC");
var ERC1538Proxy       = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecInterface     = artifacts.require(`IexecInterface${DEPLOYMENT.asset}`);
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var App                = artifacts.require("App");
var Dataset            = artifacts.require("Dataset");
var Workerpool         = artifacts.require("Workerpool");

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const tools     = require("../../../utils/tools");
const enstools  = require('../../../utils/ens-tools');
const odbtools  = require('../../../utils/odb-tools');
const constants = require("../../../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('CategoryManager', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = null;
	let appProvider     = null;
	let datasetProvider = null;
	let scheduler       = null;
	let worker1         = null;
	let worker2         = null;
	let worker3         = null;
	let worker4         = null;
	let worker5         = null;
	let user            = null;

	var RLCInstance                = null;
	var IexecInstance              = null;
	var AppRegistryInstance        = null;
	var DatasetRegistryInstance    = null;
	var WorkerpoolRegistryInstance = null;

	var categories = [];

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
		ERC712_domain              = await IexecInstance.domain();
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.at(await IexecInstance.token());

		broker          = new odbtools.Broker    (IexecInstance);
		iexecAdmin      = new odbtools.iExecAgent(IexecInstance, accounts[0]);
		appProvider     = new odbtools.iExecAgent(IexecInstance, accounts[1]);
		datasetProvider = new odbtools.iExecAgent(IexecInstance, accounts[2]);
		scheduler       = new odbtools.Scheduler (IexecInstance, accounts[3]);
		worker1         = new odbtools.Worker    (IexecInstance, accounts[4]);
		worker2         = new odbtools.Worker    (IexecInstance, accounts[5]);
		worker3         = new odbtools.Worker    (IexecInstance, accounts[6]);
		worker4         = new odbtools.Worker    (IexecInstance, accounts[7]);
		worker5         = new odbtools.Worker    (IexecInstance, accounts[8]);
		user            = new odbtools.iExecAgent(IexecInstance, accounts[9]);
		await broker.initialize();
	});

	describe("view", async () => {
		describe("invalid index", async () => {
			it("reverts", async () => {
				assert.equal(await IexecInstance.countCategory(), 6, "Error in category count");
				await expectRevert.unspecified(IexecInstance.viewCategory(6));
				assert.equal(await IexecInstance.countCategory(), 6, "Error in category count");
			});
		});
	});

	describe("create", async () => {
		describe("unauthorized create", async () => {
			it("reverts", async () => {
				assert.equal(await IexecInstance.countCategory(), 6, "Error in category count");
				await expectRevert.unspecified(IexecInstance.createCategory("fake category", "this is an attack", 0xFFFFFFFFFF, { from: user.address }));
				assert.equal(await IexecInstance.countCategory(), 6, "Error in category count");
			});
		});

		describe("authorized", async () => {
			it("success", async () => {
				assert.equal(await IexecInstance.countCategory(), 6, "Error in category count");

				txMined = await IexecInstance.createCategory("Tiny", "Small but impractical", 3, { from: iexecAdmin.address });
			});

			it("emits event", async () => {
				events = tools.extractEvents(txMined, IexecInstance.address, "CreateCategory");
				assert.equal(events[0].args.catid,            6,                       "check catid"           );
				assert.equal(events[0].args.name,             "Tiny",                  "check name"            );
				assert.equal(events[0].args.description,      "Small but impractical", "check description"     );
				assert.equal(events[0].args.workClockTimeRef, 3,                       "check workClockTimeRef");
			});

			it("count update", async () => {
				assert.equal(await IexecInstance.countCategory(), 7, "Error in category count");
			});

			it("view newly created category", async () => {
				category = await IexecInstance.viewCategory(6);
				assert.equal(category.name,             "Tiny",                  "check name"            );
				assert.equal(category.description,      "Small but impractical", "check description"     );
				assert.equal(category.workClockTimeRef, 3,                       "check workClockTimeRef");
			});
		});
	});
});
