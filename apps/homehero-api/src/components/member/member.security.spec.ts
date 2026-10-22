import 'reflect-metadata';

jest.mock('uuid', () => ({ v4: () => 'offline-image' }));
jest.mock('../auth/auth.service', () => ({ AuthService: class {} }));
jest.mock('fs', () => ({
	...jest.requireActual('fs'),
	createWriteStream: jest.fn(() => {
		const { EventEmitter } = jest.requireActual('events');
		const stream = new EventEmitter();
		queueMicrotask(() => stream.emit('finish'));
		return stream;
	}),
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Types } from 'mongoose';
import { createWriteStream } from 'fs';
import type { FileUpload } from 'graphql-upload';
import { MemberService } from './member.service';
import { MemberResolver } from './member.resolver';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { MemberInput } from '../../libs/dto/member/member.input';
import type { MemberUpdate } from '../../libs/dto/member/member.update';

const memberId = new Types.ObjectId();
const otherId = new Types.ObjectId();

function harness() {
	const record = { _id: memberId, memberType: MemberType.USER, memberStatus: MemberStatus.ACTIVE, memberPassword: 'mock-hash' };
	const exec = jest.fn().mockResolvedValue(record);
	const members = {
		create: jest.fn().mockResolvedValue(record),
		findOneAndUpdate: jest.fn(() => ({ exec })),
		findOne: jest.fn(() => ({ select: jest.fn(() => ({ exec })) })),
	};
	const auth = {
		hashPassword: jest.fn().mockResolvedValue('mock-hash'),
		comparePasswords: jest.fn().mockResolvedValue(true),
		createToken: jest.fn().mockResolvedValue('mock-token'),
	};
	return {
		service: new MemberService(members as any, {} as any, auth as any, {} as any, {} as any),
		members, auth, exec, record,
	};
}

function signupInput(memberType?: MemberType): MemberInput {
	return { memberNick: 'TestMember', memberPhone: 'test-phone', memberPassword: 'mock-password', memberType };
}

function image(mimetype = 'image/png'): FileUpload {
	return {
		filename: 'example.png', mimetype, encoding: '7bit',
		createReadStream: jest.fn(() => ({ pipe: (stream: unknown) => stream })),
	} as unknown as FileUpload;
}

describe('Member deployment security (offline)', () => {
	let log: jest.SpyInstance;
	beforeEach(() => {
		jest.clearAllMocks();
		log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});
	afterEach(() => log.mockRestore());

	it.each([undefined, MemberType.USER, MemberType.AGENT])('allows public signup role %s and preserves token creation', async (role) => {
		const { service, members, auth } = harness();
		await service.signup(signupInput(role));
		expect(members.create).toHaveBeenCalledWith({
			memberNick: 'TestMember', memberPhone: 'test-phone', memberPassword: 'mock-hash', memberType: role ?? MemberType.USER,
		});
		expect(auth.createToken).toHaveBeenCalledTimes(1);
	});

	it.each([MemberType.ADMIN, 'INVALID'])('rejects signup role %s before hashing or writing', async (role) => {
		const { service, members, auth } = harness();
		await expect(service.signup(signupInput(role as MemberType))).rejects.toBeInstanceOf(ForbiddenException);
		expect(auth.hashPassword).not.toHaveBeenCalled();
		expect(members.create).not.toHaveBeenCalled();
	});

	it('creates only allowed signup fields, ignoring injected status and counters', async () => {
		const { service, members } = harness();
		await service.signup({ ...signupInput(), memberStatus: MemberStatus.BLOCK, memberFollowers: 999, _id: otherId } as any);
		expect(members.create.mock.calls[0][0]).not.toHaveProperty('memberStatus');
		expect(members.create.mock.calls[0][0]).not.toHaveProperty('memberFollowers');
		expect(members.create.mock.calls[0][0]).not.toHaveProperty('_id');
	});

	it.each(['memberType', 'memberStatus', 'memberPassword'])('rejects protected self-update field %s, including null', async (field) => {
		const { service, members } = harness();
		for (const value of [null, field === 'memberType' ? MemberType.ADMIN : field === 'memberStatus' ? MemberStatus.BLOCK : 'mock-password']) {
			await expect(service.updateMember(memberId, { [field]: value } as any)).rejects.toBeInstanceOf(ForbiddenException);
		}
		expect(members.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it.each([MemberType.USER, MemberType.AGENT, MemberType.ADMIN])('preserves editable profile fields for %s and authenticated ownership', async (role) => {
		const { service, members, record, auth } = harness();
		record.memberType = role;
		const profile = { memberNick: 'UpdatedName', memberPhone: 'new-test-phone', memberFullName: 'Test Name', memberImage: 'uploads/member/test.png', memberAddress: 'Seoul', memberDesc: '' };
		await service.updateMember(memberId, { ...profile, _id: otherId, memberFollowers: 999, deletedAt: new Date() } as any);
		expect(members.findOneAndUpdate).toHaveBeenCalledWith(
			{ _id: memberId, memberStatus: MemberStatus.ACTIVE }, { $set: profile }, { new: true },
		);
		expect(auth.createToken).toHaveBeenCalledWith(record);
	});

	it('leaves admin role/status management on its separate guarded operation', async () => {
		const { service, members } = harness();
		const update = { _id: otherId, memberType: MemberType.AGENT, memberStatus: MemberStatus.BLOCK };
		await service.updateMemberByAdmin(update);
		expect(members.findOneAndUpdate).toHaveBeenCalledWith({ _id: otherId }, update, { new: true });
		expect(Reflect.getMetadata(GUARDS_METADATA, MemberResolver.prototype.updateMemberByAdmin)).toContain(RolesGuard);
		for (const name of ['updateMember', 'imageUploader', 'imagesUploader'] as const) {
			expect(Reflect.getMetadata(GUARDS_METADATA, MemberResolver.prototype[name])).toContain(AuthGuard);
		}
	});

	it('fails a missing/inactive self-update without issuing a new token', async () => {
		const { service, exec, auth } = harness();
		exec.mockResolvedValue(null);
		await expect(service.updateMember(memberId, { memberNick: 'UpdatedName' })).rejects.toThrow();
		expect(auth.createToken).not.toHaveBeenCalled();
	});

	it('never logs signup input, login hash/token or raw signup database errors', async () => {
		const { service, members } = harness();
		const resolver = new MemberResolver(service);
		await resolver.signup(signupInput());
		await resolver.login({ memberNick: 'TestMember', memberPassword: 'mock-password' });
		members.create.mockRejectedValue(new Error('private-db-detail mock-password mock-token'));
		await expect(resolver.signup(signupInput())).rejects.toBeInstanceOf(BadRequestException);
		for (const call of log.mock.calls) {
			expect(call).toHaveLength(1);
			expect(typeof call[0]).toBe('string');
			expect(call[0]).not.toMatch(/mock-password|mock-hash|mock-token|private-db-detail|TestMember|test-phone/);
		}
		expect(log).toHaveBeenCalledWith('Signup request failed');
	});

	it.each(['member', 'service', 'article', 'property'])('preserves single/multi upload paths for %s without filesystem writes', async (target) => {
		const resolver = new MemberResolver({} as any);
		expect(await resolver.imageUploader(image(), target)).toBe(`uploads/${target}/offline-image.png`);
		expect(await resolver.imagesUploader([Promise.resolve(image())], target)).toEqual([`uploads/${target}/offline-image.png`]);
		expect(createWriteStream).toHaveBeenCalledWith(`uploads/${target}/offline-image.png`);
	});

	it.each(['../outside', '/tmp', 'service/../../outside', 'member\\..\\outside', '', 'SERVICE', 'service%2f..'])('rejects unsafe upload target %s before streams/files are touched', async (target) => {
		const resolver = new MemberResolver({} as any);
		const file = image();
		await expect(resolver.imageUploader(file, target)).rejects.toBeInstanceOf(BadRequestException);
		await expect(resolver.imagesUploader([Promise.resolve(file)], target)).rejects.toBeInstanceOf(BadRequestException);
		expect(file.createReadStream).not.toHaveBeenCalled();
		expect(createWriteStream).not.toHaveBeenCalled();
	});

	it('retains the existing single-upload MIME rejection', async () => {
		const resolver = new MemberResolver({} as any);
		const file = image('text/plain');
		await expect(resolver.imageUploader(file, 'member')).rejects.toThrow();
		expect(file.createReadStream).not.toHaveBeenCalled();
		expect(createWriteStream).not.toHaveBeenCalled();
	});
});
