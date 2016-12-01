import React from 'react';

// Components
import CompareList from 'components/compare/CompareList';

export default class ComparePage extends React.Component {
  render() {
    return (
      <div>
        <CompareList countries={this.props.compare.countries} datasets={this.props.datasets} items={2} />
      </div>
    );
  }
}

ComparePage.propTypes = {
  compare: React.PropTypes.object,
  datasets: React.PropTypes.object
};
