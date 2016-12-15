import { substitution, concatenation } from 'utils/utils';

export function widgetsFilter(widget, { crop, country }) {
  // TODO: uncomment when using real api data
  // const _crop = crop === 'all' ? 'all_crops' : 'one_crop';
  // const _country = country ? 'country' : 'global';
  //
  // return widget.tags && widget.tags.includes(_crop) && widget.tags.includes(_country);
  return true;
}

// LAYER FUNCTIONS
export function waterConverter(string = '', filters = {}, paramsConfig = [], sqlConfig = []) {
  const yearOptions = {
    baseline: 2010,
    2020: 2020,
    2030: 2030,
    2040: 2040,
    2050: 2050
  };

  // Merge filters && paramsConfig
  const params = paramsConfig.map((param) => {
    switch (param.key) {
      case 'water_column':
        return {
          key: param.key,
          value: getWaterColumn(filters)
        };
      default:
        return {
          key: param.key,
          value: filters[param.key]
        };
    }
  });

  // Merge filters && sqlConfig
  const sqlParams = sqlConfig.map((param) => {
    return {
      key: param.key,
      keyParams: param.keyParams.map((p) => {
        switch (p.key) {
          case 'year':
            return {
              key: p.key,
              value: yearOptions[filters[p.key]]
            };
          case 'crop':
            const crop = filters[param.key];
            return {
              key: param.key,
              value: (crop !== 'all') ? crop : null
            };

          default:
            return {
              key: p.key,
              value: filters[p.key]
            };
        }
      })
    };
  });

  let str = string;
  str = substitution(str, params);
  str = concatenation(str, sqlParams);

  return str;
}


export function foodConverter(string = '', filters = {}, paramsConfig = [], sqlConfig = []) {
  // Dictionary
  const yearOptions = {
    baseline: 2005,
    2020: 2020,
    2030: 2030,
    2040: 2040,
    2050: 2050
  };

  // Merge filters && paramsConfig
  const params = paramsConfig.map((param) => {
    switch (param.key) {
      case 'year':
        return {
          key: param.key,
          value: yearOptions[filters[param.key]]
        };
      default:
        return {
          key: param.key,
          value: filters[param.key]
        };
    }
  });

  // Merge filters && sqlConfig
  const sqlParams = sqlConfig.map((param) => {
    return {
      key: param.key,
      keyParams: param.keyParams.map((p) => {
        return {
          key: p.key,
          value: filters[p.key]
        };
      })
    };
  });

  let str = string;
  str = substitution(str, params);
  str = concatenation(str, sqlParams);

  return str;
}

function getWaterColumn({ year }) {
  // Dictionary
  const yearOptions = {
    baseline: 'bs',
    2020: '20',
    2030: '30',
    2040: '40',
    2050: '50'
  };

  const _indicator = 'ws'; // 'ws'=>'Water riks layer', 'sv'=> 'Ground layer'
  const _year = yearOptions[year];
  const _dataType = 't';
  const _sufix = 'r';
  const _scenario = (year === 'baseline') ? '00' : '28';

  return `${_indicator}${_year}${_scenario}${_dataType}${_sufix}`;
}


// // TESTING
// const waterConfig = waterConverter('SELECT {{water_column}} from {{scenario}} {{crop}} {{where}} {{where1}}', {
//   crop: 'all',
//   scope: 'global',
//   country: null,
//   scenario: 'optimistic',
//   year: 'baseline',
//   food: 'xxx',
//   water: 'xxx'
// }, [
//   {
//     key: 'water_column',
//     required: true
//   },
//   {
//     key: 'crop',
//     required: true
//   },
//   {
//     key: 'scenario',
//     required: true
//   }
// ], [
//   {
//     key: 'where',
//     required: true,
//     keyParams: [
//       { key: 'year', required: true },
//       { key: 'crop' },
//       { key: 'country' }
//     ]
//   },
//   {
//     key: 'where1',
//     required: true,
//     keyParams: [
//       { key: 'year', required: true },
//       { key: 'crop' },
//       { key: 'country' }
//     ]
//   }
// ]);
// console.info(waterConfig);
