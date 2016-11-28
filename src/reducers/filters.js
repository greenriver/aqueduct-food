import { SET_FILTERS, SET_TOTAL_FILTERS, SET_SCOPE_FILTER } from 'actions/filters';

const initialState = {
  scope: 'global',
  global: {
    datasetsIds: ['4e6fbd04-253d-4fae-929e-0dbc8e106c86', '06c44f9a-aae7-401e-874c-de13b7764959'],
    layerType: 'food',
    prediction: 'optimistic'
  },
  country: {
    datasetsIds: ['4e6fbd04-253d-4fae-929e-0dbc8e106c86'],
    layerType: 'water',
    prediction: 'optimistic'
  },
  subcatchment: {
    datasetsIds: ['06c44f9a-aae7-401e-874c-de13b7764959'],
    layerType: 'food',
    prediction: 'business'
  }
};

export default function (state = initialState, action) {
  switch (action.type) {
    case SET_FILTERS:
      return Object.assign({}, state, {
        [state.scope]: action.payload
      });

    case SET_TOTAL_FILTERS:
      return Object.assign({}, state, action.payload);

    case SET_SCOPE_FILTER:
      return Object.assign({}, state, {
        scope: action.payload
      });


    default:
      return state;
  }
}
