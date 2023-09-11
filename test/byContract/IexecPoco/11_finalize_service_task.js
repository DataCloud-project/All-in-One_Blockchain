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
const enstools  = require("../../../utils/ens-tools");
const odbtools  = require("../../../utils/odb-tools");
const constants = require("../../../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('Poco', async (accounts) => {

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

	var AppInstance        = null;
	var DatasetInstance    = null;
	var WorkerpoolInstance = null;

	var apporder         = null;
	var datasetorder     = null;
	var workerpoolorder1 = null;
	var workerpoolorder2 = null;
	var requestorder     = null;

	var deals = {}
	var tasks = {};

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

	/***************************************************************************
	 *                             TEST: deposit                              *
	 ***************************************************************************/
	it("[Setup] deposit", async () => {
		switch (DEPLOYMENT.asset)
		{
			case "Native":
				await IexecInstance.deposit({ from: iexecAdmin.address, value: 10000000 * 10 ** 9 });
				break;

			case "Token":
				await RLCInstance.approveAndCall(IexecInstance.address, 10000000, "0x", { from: iexecAdmin.address });
				break;
		}
		await Promise.all([
			IexecInstance.transfer(scheduler.address, 10000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker1.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker2.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker3.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker4.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(worker5.address,   1000, { from: iexecAdmin.address }),
			IexecInstance.transfer(user.address,      10000, { from: iexecAdmin.address }),
		]);
	});

	/***************************************************************************
	 *                  TEST: App creation (by appProvider)                  *
	 ***************************************************************************/
	it("[Setup]", async () => {
		// Ressources
		txMined = await AppRegistryInstance.createApp(
			appProvider.address,
			"R Clifford Attractors",
			"DOCKER",
			constants.MULTIADDR_BYTES,
			constants.NULL.BYTES32,
			"0x",
			{ from: appProvider.address }
		);
		events = tools.extractEvents(txMined, AppRegistryInstance.address, "Transfer");
		AppInstance = await App.at(tools.BN2Address(events[0].args.tokenId));

		txMined = await DatasetRegistryInstance.createDataset(
			datasetProvider.address,
			"Pi",
			constants.MULTIADDR_BYTES,
			constants.NULL.BYTES32,
			{ from: datasetProvider.address }
		);
		events = tools.extractEvents(txMined, DatasetRegistryInstance.address, "Transfer");
		DatasetInstance = await Dataset.at(tools.BN2Address(events[0].args.tokenId));

		txMined = await WorkerpoolRegistryInstance.createWorkerpool(
			scheduler.address,
			"A test workerpool",
			{ from: scheduler.address }
		);
		events = tools.extractEvents(txMined, WorkerpoolRegistryInstance.address, "Transfer");
		WorkerpoolInstance = await Workerpool.at(tools.BN2Address(events[0].args.tokenId));

		await WorkerpoolInstance.changePolicy(/* worker stake ratio */ 35, /* scheduler reward ratio */ 5, { from: scheduler.address });

		// Orders
		apporder = await appProvider.signAppOrder({
			app:                AppInstance.address,
			appprice:           3,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			datasetrestrict:    constants.NULL.ADDRESS,
			workerpoolrestrict: constants.NULL.ADDRESS,
			requesterrestrict:  constants.NULL.ADDRESS,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		});
		datasetorder = await datasetProvider.signDatasetOrder({
			dataset:            DatasetInstance.address,
			datasetprice:       1,
			volume:             1000,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			apprestrict:        constants.NULL.ADDRESS,
			workerpoolrestrict: constants.NULL.ADDRESS,
			requesterrestrict:  constants.NULL.ADDRESS,
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		});
		workerpoolorder = await scheduler.signWorkerpoolOrder({
			workerpool:        WorkerpoolInstance.address,
			workerpoolprice:   1,
			taskmaxduration:   10000,
			volume:            1000,
			tag:               "0x0000000000000000000000000000000000000000000000000000000000000000",
			category:          5,
			trust:             10,
			apprestrict:       constants.NULL.ADDRESS,
			datasetrestrict:   constants.NULL.ADDRESS,
			requesterrestrict: constants.NULL.ADDRESS,
			salt:              web3.utils.randomHex(32),
			sign:              constants.NULL.SIGNATURE,
		});
		requestorder = await user.signRequestOrder({
			app:                AppInstance.address,
			appmaxprice:        3,
			dataset:            DatasetInstance.address,
			datasetmaxprice:    1,
			workerpool:         constants.NULL.ADDRESS,
			workerpoolmaxprice: 1,
			taskduration:       3600,
			volume:             2,
			tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
			category:           5,
			trust:              4,
			requester:          user.address,
			beneficiary:        user.address,
			callback:           constants.NULL.ADDRESS,
			params:             "<parameters>",
			salt:               web3.utils.randomHex(32),
			sign:               constants.NULL.SIGNATURE,
		});

		// Market
		await Promise.all([
			IexecInstance.matchOrders(apporder, datasetorder, workerpoolorder,        requestorder, { from: user.address }),
		]);

		deals = await odbtools.utils.requestToDeal(IexecInstance, odbtools.utils.hashRequestOrder(ERC712_domain, requestorder));
	});

	it("[setup] Initialization", async () => {
		tasks[1] = tools.extractEvents(await IexecInstance.initialize(deals[0], 0, { from: scheduler.address }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // interrupt and finalize
		tasks[2] = tools.extractEvents(await IexecInstance.initialize(deals[0], 1, { from: scheduler.address }), IexecInstance.address, "TaskInitialize")[0].args.taskid; // wait timeout and finalize
	});
	
	it("[11.1] Finalize - Interrupted", async () => {
		await IexecInstance.interrupt(
			tasks[1],                                                 // task (authorization)   
			{ from: user.address }
		)
		
		txMined = await IexecInstance.finalize(tasks[1], web3.utils.utf8ToHex("null"), "0x", { from: scheduler.address });
		events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  tasks[1],                          "check taskid");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("null"), "check consensus (results)");
	});
	
	it("[11.2] Finalize - Error (too soon)", async () => {
		await expectRevert.unspecified(IexecInstance.finalize(tasks[2], web3.utils.utf8ToHex("null"), "0x", { from: scheduler.address }));
	});
	
	it("clock fast forward", async () => {
		target = Number((await IexecInstance.viewTask(tasks[2])).finalDeadline);

		await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [ target - (await web3.eth.getBlock("latest")).timestamp ], id: 0 }, () => {});
	});

	it("[11.3] Finalize - Correct", async () => {
		txMined = await IexecInstance.finalize(tasks[2], web3.utils.utf8ToHex("null"), "0x", { from: scheduler.address });
		events = tools.extractEvents(txMined, IexecInstance.address, "TaskFinalize");
		assert.equal(events[0].args.taskid,  tasks[2],                          "check taskid");
		assert.equal(events[0].args.results, web3.utils.utf8ToHex("null"), "check consensus (results)");
	});

});
