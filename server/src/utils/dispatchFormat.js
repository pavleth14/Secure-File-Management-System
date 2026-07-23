export function maskSsn(ssn) {
  const value = String(ssn || '').replace(/\D/g, '');
  if (value.length < 4) return '***-**-****';
  return `***-**-${value.slice(-4)}`;
}

export function formatDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatTruck(truck, { maskSensitive = false } = {}) {
  const obj = truck.toObject ? truck.toObject() : truck;
  return {
    id: obj._id,
    truckNumber: obj.truckNumber,
    type: obj.type || '',
    status: obj.status,
    make: obj.make || '',
    model: obj.model || '',
    year: obj.year || '',
    vin: obj.vin || '',
    plateNumber: obj.plateNumber || '',
    dotInspectionExpiration: formatDate(obj.dotInspectionExpiration),
    platesExpiration: formatDate(obj.platesExpiration),
    notes: obj.notes || '',
    linkedFolderId: obj.linkedFolderId?._id || obj.linkedFolderId || null,
    linkedFolderName: obj.linkedFolderId?.name || null,
    linkedFolderPath: obj.linkedFolderId?.relativePath || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export function formatTrailer(trailer) {
  const obj = trailer.toObject ? trailer.toObject() : trailer;
  return {
    id: obj._id,
    trailerNumber: obj.trailerNumber,
    type: obj.type || '',
    status: obj.status,
    size: obj.size || '',
    make: obj.make || '',
    model: obj.model || '',
    year: obj.year || '',
    vin: obj.vin || '',
    plateNumber: obj.plateNumber || '',
    dotInspectionExpiration: formatDate(obj.dotInspectionExpiration),
    platesExpiration: formatDate(obj.platesExpiration),
    notes: obj.notes || '',
    linkedFolderId: obj.linkedFolderId?._id || obj.linkedFolderId || null,
    linkedFolderName: obj.linkedFolderId?.name || null,
    linkedFolderPath: obj.linkedFolderId?.relativePath || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export function formatDriver(driver, { includeSsn = false } = {}) {
  const obj = driver.toObject ? driver.toObject() : driver;
  return {
    id: obj._id,
    name: obj.name,
    driverType: obj.driverType,
    isOwnerOperator: Boolean(obj.isOwnerOperator),
    dateOfBirth: formatDate(obj.dateOfBirth),
    ssn: includeSsn ? obj.ssn || '' : maskSsn(obj.ssn),
    phone: obj.phone || '',
    email: obj.email || '',
    hiredDate: formatDate(obj.hiredDate),
    status: obj.status,
    cdlNumber: obj.cdlNumber || '',
    cdlState: obj.cdlState || '',
    cdlExpiration: formatDate(obj.cdlExpiration),
    linkedFolderId: obj.linkedFolderId?._id || obj.linkedFolderId || null,
    linkedFolderName: obj.linkedFolderId?.name || null,
    linkedFolderPath: obj.linkedFolderId?.relativePath || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export function formatAssignment(assignment) {
  const obj = assignment.toObject ? assignment.toObject() : assignment;
  const driver = obj.driverId;
  const coDriver = obj.coDriverId;
  const dispatcher = obj.dispatcherId;
  const truck = obj.truckId;

  return {
    id: obj._id,
    truckId: truck?._id || truck || null,
    truckNumber: truck?.truckNumber || null,
    truckStatus: truck?.status || null,
    driverId: driver?._id || driver || null,
    driverName: driver?.name || null,
    driverType: driver?.driverType || null,
    coDriverId: coDriver?._id || coDriver || null,
    coDriverName: coDriver?.name || null,
    dispatcherId: dispatcher?._id || dispatcher || null,
    dispatcherName: dispatcher?.name || null,
    dispatcherBoardId: dispatcher?.dispatchBoardId?._id || dispatcher?.dispatchBoardId || null,
    history: (obj.history || []).map((entry) => ({
      id: entry._id,
      action: entry.action,
      driverId: entry.driverId?._id || entry.driverId || null,
      driverName: entry.driverId?.name || null,
      coDriverId: entry.coDriverId?._id || entry.coDriverId || null,
      coDriverName: entry.coDriverId?.name || null,
      dispatcherId: entry.dispatcherId?._id || entry.dispatcherId || null,
      dispatcherName: entry.dispatcherId?.name || null,
      changedBy: entry.changedBy?._id || entry.changedBy || null,
      changedByName: entry.changedBy?.name || null,
      note: entry.note || '',
      createdAt: entry.createdAt,
    })),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export function formatBoard(board) {
  const obj = board.toObject ? board.toObject() : board;
  const teamLeader = obj.teamLeaderId;
  return {
    id: obj._id,
    boardNumber: obj.boardNumber,
    name: obj.name,
    teamLeaderId: teamLeader?._id || teamLeader || null,
    teamLeaderName: teamLeader?.name || null,
    createdAt: obj.createdAt,
  };
}
