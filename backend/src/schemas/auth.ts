export const signupSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { 
        type: 'string',
        format: 'email',
        minLength: 5,
        maxLength: 255
      },
      password: { 
        type: 'string',
        minLength: 8,
        maxLength: 255,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
      }
    },
    additionalProperties: false
  }
};

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { 
        type: 'string',
        format: 'email'
      },
      password: { 
        type: 'string',
        minLength: 1
      }
    },
    additionalProperties: false
  }
};

export const refreshTokenSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { 
        type: 'string',
        minLength: 1
      }
    },
    additionalProperties: false
  }
};

export const logoutSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
        minLength: 1
      }
    },
    additionalProperties: false
  }
};
