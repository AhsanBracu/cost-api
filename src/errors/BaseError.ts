export abstract class BaseError extends Error {

public readonly name: string;
public readonly httpcode: number;
public readonly isOperational: boolean;

constructor(name:string, httpcode: number, isOperational: boolean, description: string){
  super(description);
  Object.setPrototypeOf(this, new.target.prototype);

  this.name = name;
  this.httpcode = httpcode;
  this.isOperational = isOperational;
  Error.captureStackTrace(this);
}

}